# CLAUDE.md — Yappd Project Reference

## Project Overview
Yappd is a fullstack productivity dashboard with a Kanban board + a Telegram bot for SCDF 2nd Division HQ @ Tampines officer daily attendance reporting.
- Frontend: React + Vite + Tailwind CSS + React Router (`client/`, port 5173)
- Backend: Node.js + Express (`server/`, port 8000)
- Database: **SQLite** via Prisma ORM + `@prisma/adapter-libsql` (local file, zero hosting cost)
- Auth: JWT stored in httpOnly cookies (never localStorage)
- Bot: Telegram inline keyboards — **no Claude API**, zero per-message cost

## Repository Layout
```
yappd/
├── client/          React + Vite frontend (port 5173)
├── server/          Express API (port 8000)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── prisma.config.ts   — Prisma 7 datasource config (uses process.cwd())
│   │   └── yappd.db           — SQLite database file
│   └── src/
│       ├── bot/
│       │   ├── telegram.js    — Bot logic (1100+ lines, all session state here)
│       │   ├── parser.js      — Pure JS keyword matching + date expansion (no API)
│       │   └── digest.js      — Daily email digest via nodemailer
│       ├── config/prisma.js   — PrismaClient singleton (absolute path via __dirname)
│       ├── routes/            — index.js, auth, health, tasks, bot, officers
│       ├── controllers/       — auth, officers
│       └── middleware/        — authenticate.js, errorHandler.js
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
1. **Self-registration** — new officer DMs bot → name prompt → department keyboard → created under `UNIT_ADMIN_ID`
2. **Single-day flow** — Status keyboard → (Reason if OUT) → Date keyboard → stored
3. **Split-day flow** — AM status → PM status → Reason (if either OUT) → Date → stored
4. **Reply Keyboard** (persistent bottom buttons, always visible):
   - `📋 Report Today` → opens single-day Status keyboard
   - `📅 Plan This Week` → opens 5-day week grid
   - `📅 Plan Next Week` → opens 5-day week grid for next week
   - `📊 My Status` → shows today's logged status
5. **Week grid** — interactive 5-day planner in one Telegram message, edits in-place. Supports per-day IN/OUT/Split, `✅ All IN` bulk action, pre-fills from existing DB records.
6. **Keyword shortcuts** — `in`, `mc`, `vl`, `wfh`, `ovl`, `oil`, `course` trigger instant logging without keyboard

### Session Maps in telegram.js
```
sessions     — single-day availability flow
regSessions  — self-registration wizard
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
`id`, `email` (unique), `passwordHash`, `refreshToken?`, `tasks[]`, `officers[]`

### Officer
`id`, `telegramId` (unique), `telegramName?`, `name?`, `rank?`, `department?`, `adminId` → User

### Availability
`id`, `officerId` → Officer, `date` (DateTime), `status` (IN|OUT), `reason?`, `rawMessage`, `notes?`
Unique constraint: `[officerId, date]` — one record per officer per day (upsert)

### Task (Kanban board)
`id`, `title`, `description?`, `status` (TODO|IN_PROGRESS|YAPPD), `priority` (LOW|MEDIUM|HIGH|URGENT), `tag?`, `position`, `dueDate?`, `userId`

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
UNIT_ADMIN_ID=             # User.id of the admin who owns all officers
```

## Key Packages
- **Server:** express, @prisma/client, @prisma/adapter-libsql, bcrypt, jsonwebtoken, cookie-parser, cors, dotenv, express-async-errors, node-telegram-bot-api, nodemailer, node-cron
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
