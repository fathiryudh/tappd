# Yappd

Yappd is a fullstack productivity dashboard for SCDF 2nd Division HQ @ Tampines. It combines a Kanban task board with a Telegram bot for daily officer attendance reporting.

---

## What it does

### Kanban Board
A drag-and-drop task board for the unit. Create tasks, set priorities, track progress across TODO → IN PROGRESS → DONE columns. Accessible via web login.

### Telegram Attendance Bot
Officers DM the bot to log their daily availability. Everything is tap-based — no typing required for standard statuses.

### Public Roster Page
A no-login HTML page showing today's attendance at a glance. Auto-refreshes every 5 minutes. Share the URL with commanders who don't need a full login.

### Daily Email Digest + Nudges
- **7:30 AM** — Bot messages every officer who hasn't reported yet
- **8:30 AM** — Email digest sent to the admin + second nudge for anyone still unreported

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite via Prisma 7 + `@prisma/adapter-libsql` |
| Auth | JWT in httpOnly cookies |
| Bot | Telegram (node-telegram-bot-api, no Claude API) |
| Email | Nodemailer + Gmail SMTP |

---

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd client && npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` in the `server/` directory and fill in:

```env
PORT=8000
JWT_ACCESS_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

TELEGRAM_BOT_TOKEN=        # from @BotFather
TELEGRAM_WEBHOOK_SECRET=   # any random string
WEBHOOK_BASE_URL=          # your ngrok https URL (local dev)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=                 # Gmail address
SMTP_PASS=                 # Gmail App Password (not your account password)
DIGEST_EMAIL=              # where the daily digest gets sent

BOT_ADMIN_EMAIL=           # email of the Yappd account that owns all officers
```

### 3. Database

```bash
cd server
npx prisma migrate dev --name init
```

This creates `prisma/yappd.db`. Run it once on first setup.

### 4. Create your admin account

Start the server and register via `POST /api/v1/auth/register` with `{ email, password }`. This is the account whose email you set in `BOT_ADMIN_EMAIL`.

### 5. Run locally

```bash
# Terminal 1 — API server
cd server && npm run dev

# Terminal 2 — React frontend
cd client && npm run dev

# Terminal 3 — Telegram webhook tunnel
ngrok http 8000
# Copy the https URL → paste into WEBHOOK_BASE_URL in server/.env → restart server
```

- Web app: `http://localhost:5173`
- Roster page: `http://localhost:8000/roster`

---

## Features

### Telegram Bot

#### Self-registration
Officers DM the bot `/start` and follow two prompts (rank, then name). They're automatically linked to the unit admin. No admin pre-setup needed.

If an officer sends `/start` again after registering, they get a usage reminder instead of re-registration.

#### Logging status (tap-based)
Tap `📋 Report Today` or send any message → pick status from keyboard:

| Status | What it means |
|--------|--------------|
| In | Officer is at station |
| Out | Officer is absent — must pick a reason |
| Split Day | Different AM and PM status |

**Reasons for Out:** MC, VL, OVL, OIL, WFH, Course, Appointment, Family Emergency, or free text.

**Keyword shortcuts** — type these instead of tapping:
```
in        → logged IN for today
mc        → OUT (MC) for today
mc tmr    → OUT (MC) for tomorrow
vl        → OUT (VL) for today
wfh       → OUT (WFH) for today
ovl       → OUT (OVL) for today
oil       → OUT (OIL) for today
course    → OUT (Course) for today
```

#### Week planner
Tap `📅 Plan This Week` or `📅 Plan Next Week` → interactive 5-day grid appears. Set each day individually or tap **All IN** to bulk-set the remaining days. Edits in-place, no new messages spammed.

#### My Status
Tap `📊 My Status` to see what you've logged for today.

#### Reply keyboard (persistent)
Four buttons pinned to the bottom of every chat:
- `📋 Report Today`
- `📅 Plan This Week`
- `📅 Plan Next Week`
- `📊 My Status`

### Public Roster Page

Visit `/roster` (no login required):

```
SCDF 2 Div HQ — Monday, 14 April 2026

CPT John Tan          In
LTA Sarah Lim         Out — VL
ME3 Bob Koh           Unconfirmed

3 officers · 1 in · 1 out · 1 unconfirmed
Last updated: 08:32 AM
```

- Green row = In
- Muted row = Out (with reason)
- Yellow row = Unconfirmed (not reported yet)
- Auto-refreshes every 5 minutes
- Share the URL directly — no login, no app install

### Daily Digest Email

Sent at **8:30 AM SGT** on weekdays. Example:

```
[IN]  CPT John Tan
[OUT] LTA Sarah Lim — VL
[?]   ME3 Bob Koh — Unconfirmed

2 in · 1 out · 1 unconfirmed
```

### Nudge Reminders

- **7:30 AM** — Telegram DM to every officer with no status for today
- **8:30 AM** — Second DM to anyone still unreported (sent after the digest)

Message: *"Morning [name], quick reminder to update your status before 0830. Just type 'in', 'mc', 'vl' or whatever applies."*

### Manual Officer Management

Add an officer manually (useful for officers who can't DM the bot):

```bash
cd server
node scripts/add-officer.js <telegramId> <name> <rank> <adminEmail>
```

Example:
```bash
node scripts/add-officer.js 123456789 "John Tan" "CPT" admin@unit.sg
```

---

## API Routes

All routes prefixed with `/api/v1`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | — | Logout |
| GET | `/health` | — | Server health check |
| GET | `/officers` | ✓ | List all officers |
| POST | `/officers` | ✓ | Add officer manually |
| PATCH | `/officers/:id` | ✓ | Update officer |
| DELETE | `/officers/:id` | ✓ | Remove officer |
| GET | `/officers/roster?date=YYYY-MM-DD` | ✓ | Roster for a date |
| GET | `/tasks` | ✓ | List tasks |
| POST | `/tasks` | ✓ | Create task |
| PATCH | `/tasks/:id` | ✓ | Update task |
| DELETE | `/tasks/:id` | ✓ | Delete task |
| POST | `/bot/telegram` | webhook | Telegram update handler |

**Public (no auth):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roster` | Today's attendance page |

---

## Database Schema

```
User         — Yappd accounts (admin logins)
Officer      — Telegram users linked to an admin
Availability — One record per officer per day (IN/OUT + reason)
Task         — Kanban board tasks
```

The SQLite database lives at `server/prisma/yappd.db`. It is not committed to the repo.
