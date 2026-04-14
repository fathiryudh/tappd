# Yappd

Telegram bot + public roster website for daily attendance reporting at SCDF 2nd Division HQ @ Tampines.

Officers DM the bot to log their status for the day. A public web page shows the full roster — no login required.

---

## Features

### Telegram Bot

- **Self-registration** — any officer sends `/start`, enters their rank and name, and is immediately on the roster. No admin setup required.
- **Keyword shortcuts** — type `in`, `mc`, `vl`, `wfh`, `ovl`, `oil`, or `course` to log instantly without tapping keyboards.
- **Persistent reply keyboard** — four tap-friendly buttons always visible at the bottom of chat:
  - `📋 Report Today` — opens today's status flow
  - `📅 Plan This Week` — opens the 5-day week planner grid
  - `📅 Plan Next Week` — opens next week's planner grid
  - `📊 My Status` — shows today's logged status, with option to edit
- **Split-day support** — log AM/PM separately (e.g. `OUT(MC)/IN` or `IN/OUT(VL)`)
- **Week planner grid** — interactive 5-day planner in a single Telegram message that edits in-place; supports per-day IN/OUT/Split, bulk "All IN" action, pre-filled from existing records
- **Edit today's status** — tap `📊 My Status` then ✏️ Edit today's status to resubmit
- **Deregister** — `/deregister` removes your profile and all attendance history (requires typing `YES` to confirm)
- **Morning nudges** — bot reminds unreported officers at 7:30 AM and 8:30 AM SGT, Mon–Fri
- **Daily digest email** — summary email sent at 8:30 AM SGT if `DIGEST_EMAIL` is set

### Roster Page

Public page at `http://<server>/roster`:

- Shows all registered officers and their status for today
- Status formats: `IN`, `OUT(MC)`, `OUT(VL)`, `IN/OUT(VL)`, `OUT(MC)/IN`, `Unconfirmed`
- Colour-coded: green (IN), red (OUT), purple (split day), amber (unconfirmed)
- Auto-refreshes every 5 minutes
- No login required

---

## Running Locally

```bash
# Terminal 1 — server (port 8000)
cd server && npm run dev

# Terminal 2 — ngrok (required for Telegram webhook)
ngrok http 8000
# Copy the https URL → set WEBHOOK_BASE_URL in server/.env → restart server
```

Roster is at: `http://localhost:8000/roster`

---

## Environment Variables

Create `server/.env` from `server/.env.example`:

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
```

---

## Database

SQLite file at `server/prisma/yappd.db` — no hosting cost, no setup required.

```bash
# Apply migrations
cd server && npx prisma migrate deploy

# Browse data
cd server && npx prisma studio
```

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register or see welcome message if already registered |
| `/status` | Show today's logged status |
| `/report` | Open status keyboard |
| `/deregister` | Delete your profile (asks for YES confirmation) |

---

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite via Prisma 7 + `@prisma/adapter-libsql`
- **Bot**: `node-telegram-bot-api`, webhook mode, inline + reply keyboards
- **Email**: nodemailer (SMTP)
- **Scheduler**: node-cron
