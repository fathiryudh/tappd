# CLAUDE.md

## Architecture
- `client/` is a React 19 + Vite admin app. Main screens live in `client/src/pages`; reusable UI lives in `client/src/components`.
- `client/src/pages/auth/` holds the shared auth layout used by login and register.
- `server/` is an Express API plus the Telegram bot. Bot state is managed in-memory in `server/src/bot/telegram.js`.
- Data is stored in SQLite at `server/prisma/yappd.db` and accessed through Prisma 7.
- Core records:
  - `User` owns admin access.
  - `Officer` is the roster entity and may reference `Division` and `Branch`.
  - `Availability` stores one officer/day attendance record.
  - `NotificationEvent` stores dashboard notification items.

## Commands
- Install deps:
  - `cd server && npm install`
  - `cd client && npm install`
- Run locally:
  - `cd server && npm run dev`
  - `cd client && npm run dev`
  - `ngrok http 8000`
- Frontend checks:
  - `cd client && npm run lint`
  - `cd client && npm run build`
- Bot tests:
  - `cd server && npm test`
  - `cd server && npm run test:watch`
- Prisma / seed data:
  - `cd server && npx prisma migrate dev --name <name>`
  - `cd server && npx prisma studio`
  - `cd server && node prisma/seed-divisions.js`
  - `cd server && node scripts/seed-demo.js`
  - `cd server && node scripts/reassign-admin.js <fromAdminId> <toAdminId>`

## Coding Conventions
- Use Prisma, not raw SQL.
- Use `async/await`; avoid callback flow and `.then()` chains in app logic.
- Keep auth in httpOnly cookies. Do not move tokens into local storage.
- Reuse existing bot helpers and session maps before adding new bot state shapes.
- Keep Telegram copy and button labels aligned with the existing bot UX unless the task requires changing them.
- Update or add Jest tests in `server/tests/bot` when bot behavior changes.
- Keep dashboard date handling in local time when the UI is meant to reflect Singapore workdays.
- When storing or querying attendance by ISO day, use the shared date helpers in `server/src/utils/date.js` instead of ad hoc `new Date('YYYY-MM-DD')` parsing.

## Constraints
- SQLite compatibility matters. Do not use Prisma options unsupported by SQLite.
- Prisma datasource config is split across `server/prisma/schema.prisma` and `server/prisma/prisma.config.ts`.
  - Do not add `url =` to the datasource block.
  - Do not switch runtime DB setup to `DATABASE_URL`; `server/src/config/prisma.js` resolves the SQLite file path directly.
- `Division` and `Branch` are normalized tables. Do not reintroduce free-text department fields.
- `Officer.phoneNumber` is required, unique, and must stay normalized through `normalizePhone`.
- Bot sessions are in-memory Maps. Preserve stale-keyboard and message-id guards when changing Telegram flows.
- The dashboard attendance view refreshes both on its own timer and when new officer notification events arrive. Keep those paths aligned.
- There is no server lint script. Do not document or rely on one unless you add it first.
