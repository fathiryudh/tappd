# Yappd

Admin dashboard + Telegram bot for daily attendance reporting at SCDF 2nd Division HQ @ Tampines.

Officers DM the bot to log their status for the day. Admins view and manage the weekly roster on a web dashboard — login required.

---

## Features

### Telegram Bot

- **Self-registration** — officer sends `/start`, shares phone number, enters rank and name. No admin setup required.
- **Keyword shortcuts** — type `in`, `mc`, `vl`, `wfh`, `ovl`, `oil`, or `course` to log instantly without tapping keyboards.
- **Persistent reply keyboard** — four tap-friendly buttons always visible at the bottom of chat:
  - `📋 Report Today` — opens today's status flow (no date picker — always logs for today)
  - `📅 Plan This Week` — opens the 5-day week planner grid
  - `📅 Plan Next Week` — opens next week's planner grid
  - `📊 My Status` — shows today's logged status, with option to edit
- **Split-day support** — log AM/PM separately (e.g. `OUT(MC)/IN` or `IN/OUT(VL)`)
- **Week planner grid** — interactive 5-day planner in a single Telegram message that edits in-place; supports per-day IN/OUT/Split, bulk "All IN" action, pre-filled from existing records
- **Edit today's status** — tap `📊 My Status` → ✏️ Edit today's status to resubmit
- **Deregister** — `/deregister` removes your profile and all attendance history (requires typing `YES` to confirm)
- **Morning nudges** — bot reminds unreported officers at 7:30 AM and 8:30 AM SGT, Mon–Fri
- **Daily digest email** — summary email sent at 8:30 AM SGT if `DIGEST_EMAIL` is set

OUT reasons: `MC`, `VL`, `OVL`, `OIL`, `WFH`, `Course`, `Appointment`, `Family Emergency`, or free text.

### Admin Dashboard

Web app at `http://localhost:5173` (login required):

- **Roster tab** — officer list with inline edit (rank, name, department) and deregister
- **Attendance tab** — weekly grid showing each officer's status for Mon–Fri; navigate weeks with ← →; today highlighted; auto-refreshes every minute

The standalone `/roster` route shows the same weekly grid without the sidebar.

---

## Running Locally

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Apply migrations
cd server && npx prisma migrate dev

# Terminal 1 — API server (port 8000)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev

# Terminal 3 — Telegram webhook tunnel
ngrok http 8000
# Copy the https:// URL → set WEBHOOK_BASE_URL in server/.env → restart server
```

---

## Environment Variables

Create `server/.env`:

```
PORT=8000
JWT_ACCESS_SECRET=           # 256-bit hex string
JWT_REFRESH_SECRET=          # 256-bit hex string
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

TELEGRAM_BOT_TOKEN=          # from @BotFather
TELEGRAM_WEBHOOK_SECRET=     # random string for webhook security
WEBHOOK_BASE_URL=            # ngrok https URL (local) or production URL

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=                   # Gmail address
SMTP_PASS=                   # Gmail App Password
DIGEST_EMAIL=                # email to receive daily digest (optional)

BOT_ADMIN_EMAIL=             # email of the admin user who owns all officers
```

---

## Testing

```bash
cd server && npm test          # run all bot tests
cd server && npm run test:watch # watch mode
```

Jest test suite covering every bot button and flow — Report Today, week grid, keywords, registration, and chaos/stale-keyboard scenarios. No real DB or Telegram connection needed.

---

## Database

SQLite file at `server/prisma/yappd.db` — no hosting cost, no setup required.

```bash
cd server && npx prisma migrate dev   # apply migrations
cd server && npx prisma studio        # browse data
```

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register or see welcome message if already registered |
| `/deregister` | Delete your profile (asks for YES confirmation) |

---

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite via Prisma 7 + `@prisma/adapter-libsql`
- **Frontend**: React + Vite + Tailwind CSS
- **Bot**: `node-telegram-bot-api`, webhook mode, inline + reply keyboards
- **Email**: nodemailer (SMTP)
- **Scheduler**: node-cron
- **Tests**: Jest
