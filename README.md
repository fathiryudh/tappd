# Yappd

Admin dashboard plus Telegram bot for daily attendance reporting at SCDF 2nd Division HQ.

## What It Does
- Officers register and report attendance through Telegram.
- Admins manage the roster and review weekly attendance from the web dashboard.
- The dashboard shows live notification events as officers submit or edit status.
- The attendance view can be refreshed manually and also updates automatically when new officer status notifications arrive.

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
- Shared login/register auth layout under `client/src/pages/auth/`
- Standalone `/attendance` page for the weekly attendance board without the admin sidebar
- Public `/roster` page for the Telegram-linked day roster view

## Run Locally
```bash
# install dependencies from the repo root
npm install

# generate Prisma client
cd server && npx prisma generate

# optional seed default divisions in Supabase
node prisma/seed-divisions.js

# terminal 1
cd ..
npm run dev

# terminal 2
npm run dev:client

# terminal 3
ngrok http 8000
```

Set `WEBHOOK_BASE_URL` in `server/.env` to the ngrok HTTPS URL before testing Telegram webhook flows locally.

## Safe Change Workflow
If you want to make changes without touching the live site, use a feature branch.

```bash
git checkout main
git pull origin main
git checkout -b my-feature-branch
```

Do your work on that branch, test locally, then commit and push:

```bash
git add .
git commit -m "Describe the change"
git push -u origin my-feature-branch
```

Important:
- `main` is the live production branch
- one branch should usually be one small goal
- test locally before merging to `main`
- commit once per logical change, not once per file

## Environment
Create `server/.env`:

```env
PORT=8000
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.[project-ref]
DB_PASSWORD=
DB_SCHEMA=public
DB_USE_LIBPQ_COMPAT=true
DB_SSLMODE=require
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

`DATABASE_URL` is still supported as an override, but the app can now build the Postgres connection string from the `DB_*` variables so the password can stay separate.

If you need to re-import legacy local data into Supabase:

```bash
node server/scripts/migrate-sqlite-to-supabase.js server/prisma/yappd.db
```

## Production Deploy
This repo can now be deployed as one Node app:

```bash
npm install
npm run build
npm run db:generate
npm start
```

What that does:
- builds the Vite client into `client/dist`
- serves the built frontend from Express on the same origin as the API
- keeps API routes under `/api/v1`
- keeps the public `/roster` and `/weekly-roster` server routes available

How Render works in simple terms:
- Render watches a GitHub branch, usually `main`
- your local changes are not live until you `git push`
- once the new commit is on GitHub, Render can deploy it
- if you work on a feature branch, production stays unchanged unless Render is told to deploy that branch
- Render environment variables are production settings and secrets; they are separate from your local `server/.env`
- if you change Render env vars, redeploy the service so the new values are used

Recommended production env:

```env
NODE_ENV=production
PORT=8000
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.[project-ref]
DB_PASSWORD=replace-me
DB_SCHEMA=public
DB_USE_LIBPQ_COMPAT=true
DB_SSLMODE=require
JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me
WEBHOOK_BASE_URL=https://your-domain.example
TELEGRAM_WEBHOOK_SECRET=replace-me
```

## Checks
```bash
cd client && npm run lint
cd client && npm run build
cd ../server && npm test
```

## Utilities
- `cd server && node scripts/add-officer.js <phoneNumber> <name> <rank> <adminEmail> [divisionName] [branchName] [telegramId]`
- `cd server && node scripts/reassign-admin.js <fromAdminId> <toAdminId>`

## Notes
- Attendance day matching uses explicit UTC start-of-day conversion on the server so Singapore dates do not drift into the previous or next day.
- The old legacy preview auth/roster pages were removed; the active auth flow now lives only in the shared auth layout and the real login/register pages.
- In production the React app is served by Express, so `/login`, `/register`, `/dashboard`, and `/attendance` live on the same host as the API.
- The checked-in Prisma migration history is from the earlier SQLite phase and should not be applied to Supabase.

## Stack
- React + Vite + Tailwind CSS
- Node.js + Express
- Prisma 7 + Supabase Postgres
- `node-telegram-bot-api`
- Jest
