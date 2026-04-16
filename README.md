# Yappd

Admin dashboard plus Telegram bot for daily attendance reporting at SCDF 2nd Division HQ.

## What It Does
- Officers register and report attendance through Telegram.
- Admins manage the roster and review weekly attendance from the web dashboard.
- The dashboard also shows live notification events as officers submit or edit status.

## Telegram Bot
- Self-registration through `/start`
- Profile editing for name, rank, division, branch, and phone
- `Report Today`, `Plan This Week`, and `Plan Next Week` flows
- Split-day attendance such as `AM in, PM out (WFH)`
- `/roster`, `/editprofile`, and `/deregister`
- Morning reminder nudges and optional digest email

## Admin UI
- `/dashboard` for the admin app
- Roster view for officer records
- Attendance view for Mon-Fri weekly status
- Standalone `/roster` page for the attendance board without the admin sidebar

## Run Locally
```bash
# install dependencies
cd server && npm install
cd ../client && npm install

# apply migrations
cd ../server && npx prisma migrate dev

# seed default divisions
node prisma/seed-divisions.js

# optional fixed demo officers + attendance dataset
node scripts/seed-demo.js

# terminal 1
npm run dev

# terminal 2
cd ../client && npm run dev

# terminal 3
ngrok http 8000
```

Set `WEBHOOK_BASE_URL` in `server/.env` to the ngrok HTTPS URL before testing Telegram webhook flows locally.

## Environment
Create `server/.env`:

```env
PORT=8000
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
WEBHOOK_BASE_URL=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
DIGEST_EMAIL=

BOT_ADMIN_EMAIL=
```

## Checks
```bash
cd client && npm run lint
cd client && npm run build
cd ../server && npm test
```

## Stack
- React + Vite + Tailwind CSS
- Node.js + Express
- Prisma 7 + SQLite
- `node-telegram-bot-api`
- Jest
