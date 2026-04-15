# CLAUDE.md — Yappd Project Reference

## Project Overview
Yappd is a fullstack admin dashboard + Telegram bot for SCDF 2nd Division HQ @ Tampines officer daily attendance reporting.
- Frontend: React + Vite + Tailwind CSS + React Router (`client/`, port 5173)
- Backend: Node.js + Express (`server/`, port 8000)
- Database: **SQLite** via Prisma ORM + `@prisma/adapter-libsql` (local file, zero hosting cost)
- Auth: JWT stored in httpOnly cookies (never localStorage)
- Bot: Telegram inline keyboards — **no Claude API**, zero per-message cost
- Dashboard: `/dashboard` has two tabs — **Roster** (officer list) and **Attendance** (weekly grid via `RosterView`)

## Repository Layout
```
yappd/
├── client/          React + Vite frontend (port 5173)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx   — Admin dashboard (Roster + Attendance tabs)
│       │   ├── Roster.jsx      — Thin shell wrapping RosterView for standalone /roster route
│       │   └── Login.jsx
│       └── components/
│           └── roster/
│               ├── RosterView.jsx   — Weekly attendance grid (reused in both /roster and Dashboard)
│               └── OfficerList.jsx  — Officer management table (Dashboard Roster tab)
├── server/          Express API (port 8000)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── prisma.config.ts   — Prisma 7 datasource config (uses process.cwd())
│   │   └── yappd.db           — SQLite database file
│   ├── src/
│   │   ├── bot/
│   │   │   ├── telegram.js    — Bot logic (all session state here)
│   │   │   ├── parser.js      — Pure JS keyword matching + date expansion (no API)
│   │   │   └── digest.js      — Daily email digest via nodemailer
│   │   ├── config/prisma.js   — PrismaClient singleton (absolute path via __dirname)
│   │   ├── routes/            — index.js, auth, health, bot, officers
│   │   ├── controllers/       — auth, officers
│   │   └── middleware/        — authenticate.js, errorHandler.js
│   ├── tests/
│   │   └── bot/
│   │       ├── helpers.js              — Mock factories + setupMocks()
│   │       ├── report-today.test.js    — Report Today full-day + split flows
│   │       ├── week-grid.test.js       — Plan This/Next Week grid flows
│   │       ├── keyword.test.js         — Keyword shortcut flows
│   │       ├── registration.test.js    — /start, phone verification, /deregister
│   │       └── chaos.test.js           — Out-of-order, rapid, stale-session tests
│   └── jest.config.js
└── CLAUDE.md
```

## Running the Project
```bash
# Terminal 1 — server (port 8000)
cd server && npm run dev      # nodemon

# Terminal 2 — client (port 5173)
cd client && npm run dev

# Terminal 3 — ngrok (required for Telegram webhook in local dev)
ngrok http 8000
# Copy the https URL → set WEBHOOK_BASE_URL in server/.env → restart server
```

## Telegram Bot Architecture
Officers DM the bot their daily attendance. No typing required — everything is tap-based.

### Status model (binary)
- **IN** — officer is at station
- **OUT** — officer is not at station, always has a reason: `MC`, `VL`, `OVL`, `OIL`, `WFH`, `Course`, `Appointment`, `Family Emergency`, or free text

### Bot flows
1. **Self-registration** — new officer DMs bot → phone verification → rank prompt → name prompt → created under `BOT_ADMIN_EMAIL` admin
2. **Single-day flow** — Status keyboard → (Reason if OUT) → Date keyboard → stored
   - **`reportToday` flag**: When triggered via `📋 Report Today` or `✏️ Edit Today`, `session.reportToday = true` is set so the date step is skipped — status/reason immediately logs for today without showing a date picker.
3. **Split-day flow** — AM status → PM status → Reason (if either OUT) → stored (always for today when via Report Today)
4. **Reply Keyboard** (persistent bottom buttons, always visible):
   - `📋 Report Today` → opens single-day Status keyboard, sets `reportToday: true`
   - `📅 Plan This Week` → opens 5-day week grid
   - `📅 Plan Next Week` → opens 5-day week grid for next week
   - `📊 My Status` → shows today's logged status
5. **Week grid** — interactive 5-day planner in one Telegram message, edits in-place. Supports per-day IN/OUT/Split, `✅ All IN` bulk action, pre-fills from existing DB records.
6. **Keyword shortcuts** — `in`, `mc`, `vl`, `wfh`, `ovl`, `oil`, `course` trigger instant logging without keyboard
7. **`/deregister`** — officer types YES to confirm deletion of their own record

### Session guards (telegram.js)
- **messageId guard**: When a callback arrives, `session.messageId` is compared to the incoming `message_id`. If they don't match, the old keyboard is replaced with "This keyboard has expired." — prevents stale double-taps.
- **Keyboard clearing on new session**: Opening a new Report Today flow disables the previous session's inline keyboard before creating a new session, so old buttons can't be tapped out-of-order.
- **NSF guard**: Officers with `isNSF: true` cannot log OUT — attempting to do so sends a guard message.

### Session Maps in telegram.js
```
sessions     — single-day availability flow
weekSessions — week grid flow
```

### Callback data prefixes
- `status:`, `reason:`, `splitreason:`, `am:`, `pm:`, `date:`, `dept:` — single-day flow
- `week_day:`, `week_status:`, `week_reason:`, `week_am:`, `week_pm:`, `week_split_reason:`, `week_back`, `week_all_in`, `week_confirm`, `week_cancel` — week grid flow

### parser.js exports
```js
keywordMatch(raw, todayISO, tomorrowISO)  // returns records[] or null
expandRecords(records, todayISO)           // expands weekRange/onwards to daily records
getDayISO(targetDow, todayISO)             // next occurrence of day-of-week
addDays(isoDate, n)
getMondayOfWeek(isoDate)
getNextWeekMonday(isoDate)
```

## API Routes
- All routes prefixed: `/api/v1`
- Auth: `/api/v1/auth/{register,login,refresh,logout}`
- Health: `GET /api/v1/health`
- Officers (admin): `GET/POST /api/v1/officers`, `PATCH/DELETE /api/v1/officers/:id`, `GET /api/v1/officers/roster?date=YYYY-MM-DD`
- Telegram webhook: `POST /api/v1/bot/telegram`
- Protected routes use `authenticate` middleware

## Auth Flow
- Access token: JWT, 15min TTL, httpOnly cookie `access_token`
- Refresh token: JWT, 7d TTL, httpOnly cookie `refresh_token`
  - Also stored in `users.refreshToken` in DB for reuse detection
- Logout nulls DB refreshToken and clears both cookies
- Client silently restores session on mount via `POST /api/v1/auth/refresh`

## Database
- Provider: **SQLite** (local file at `server/prisma/yappd.db`)
- ORM: Prisma 7 with `@prisma/adapter-libsql` driver adapter
- **Critical**: `PrismaLibSql` is a factory — pass `{ url: 'file:/absolute/path' }` config object, NOT a pre-created client
- **Critical**: `schema.prisma` has no `url =` in the datasource block — Prisma 7 reads URL from `prisma.config.ts`
- `prisma.js` uses `path.join(__dirname, '../../prisma/yappd.db')` — never `process.env.DATABASE_URL` for SQLite
- Migration: `cd server && npx prisma migrate dev --name <name>`
- Studio: `cd server && npx prisma studio`

## Database Models
### User
`id`, `email` (unique), `passwordHash`, `refreshToken?`, `officers[]`

### Officer
`id`, `telegramId` (unique), `telegramName?`, `name?`, `rank?`, `department?`, `phone?`, `isNSF`, `adminId` → User

### Availability
`id`, `officerId` → Officer, `date` (DateTime), `status` (IN|OUT), `reason?`, `rawMessage`, `notes?`
Unique constraint: `[officerId, date]` — one record per officer per day (upsert)

## Environment Variables (`server/.env`)
```
PORT=8000
JWT_ACCESS_SECRET=<256-bit hex>
JWT_REFRESH_SECRET=<256-bit hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
TELEGRAM_BOT_TOKEN=        # from @BotFather
TELEGRAM_WEBHOOK_SECRET=   # random string for webhook security
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=                 # Gmail address
SMTP_PASS=                 # Gmail App Password
DIGEST_EMAIL=              # admin email for daily digest
WEBHOOK_BASE_URL=          # ngrok https URL (local dev) or production URL
BOT_ADMIN_EMAIL=           # Email of the admin user who owns all officers
```

## Testing
```bash
cd server && npm test          # run all bot tests once
cd server && npm run test:watch # watch mode
```

- **Framework:** Jest (CommonJS mode, no Babel/transform)
- **Config:** `server/jest.config.js` — `testMatch: ['**/tests/**/*.test.js']`, `testEnvironment: 'node'`
- **Mocking strategy:** `jest.resetModules()` + `jest.doMock()` inside `setupMocks()` in `helpers.js` — re-requires `telegram.js` fresh each test so in-memory session Maps are always empty
- **Bot mock:** `jest.doMock('node-telegram-bot-api', ...)` replaces `TelegramBot` with a constructor returning `jest.fn()` stubs for `sendMessage`, `editMessageText`, `editMessageReplyMarkup`, `answerCallbackQuery`
- **Prisma mock:** `jest.doMock('../../src/config/prisma', ...)` stubs all methods used by the bot; default `findUnique` returns a registered officer stub
- **Test files:** `helpers.js`, `report-today.test.js`, `week-grid.test.js`, `keyword.test.js`, `registration.test.js`, `chaos.test.js` — all in `server/tests/bot/`

## Key Packages
- **Server:** express, @prisma/client, @prisma/adapter-libsql, bcrypt, jsonwebtoken, cookie-parser, cors, dotenv, express-async-errors, node-telegram-bot-api, nodemailer, node-cron
- **Server devDependencies:** jest
- **Client:** react, react-router-dom, axios, tailwindcss

## Error Handling
- `express-async-errors` patches all async handlers — no try/catch needed in route handlers
- All errors route to `src/middleware/errorHandler.js`
- Throw pattern: `const err = new Error('Unauthorized'); err.status = 401; throw err;`

## Code Conventions
- `async/await` only — no callbacks, no `.then()` in server code
- No hardcoded secrets — all from `process.env`
- Prisma for all DB access — no raw SQL
- CORS: `credentials: true`, origin from `CLIENT_ORIGIN` env var
- Cookie flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production
- Bot confirmations use fun/casual Singlish-flavoured language (see `buildConfirmText` in telegram.js)
