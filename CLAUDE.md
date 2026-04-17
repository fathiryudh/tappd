# CLAUDE.md

## Architecture
- `client/` is a React 19 + Vite admin app. Main screens live in `client/src/pages`; reusable UI lives in `client/src/components/ui/`.
- `client/src/pages/auth/` holds the shared auth layout (`AuthLayout`, `AuthField`, `AuthError`) used by Login and Register.
- `client/src/components/ui/HeroHighlight.jsx` — dot-pattern background with mouse-tracked indigo reveal; used as the left panel of the auth layout.
- Auth layout is `flex-col` on mobile/tablet, `xl:grid` with two columns and explicit `h-[100dvh]` on desktop. Do not reintroduce `min-h` + `1fr` rows — that breaks mobile scroll and creates layout gaps.
- `server/` is an Express API plus the Telegram bot. Bot state is managed in-memory in `server/src/bot/telegram.js`.
- Data is stored in Supabase Postgres and accessed through Prisma 7 with `pg` + `@prisma/adapter-pg`.
- **Prisma is used schema-first (`db pull`) — no migrations are run against Supabase.** The checked-in migrations under `server/prisma/migrations` are SQLite-era history only; ignore them.
- Core records:
  - `User` owns admin access.
  - `Officer` is the roster entity and may reference `Division` and `Branch`.
  - `Availability` stores one officer/day attendance record.
  - `NotificationEvent` stores dashboard notification items.

## Commands
- Install deps:
  - `npm install`
- Run locally:
  - `npm run dev`
  - `npm run dev:client`
  - `ngrok http 8000`
- Frontend checks:
  - `cd client && npm run lint`
  - `cd client && npm run build`
- Bot tests:
  - `cd server && npm test`
  - `cd server && npm run test:watch`
- Prisma / seed data:
  - `cd server && npx prisma generate`
  - `cd server && npx prisma db pull`
  - `cd server && npx prisma studio`
  - `cd server && node prisma/seed-divisions.js`
  - `cd server && node scripts/seed-demo.js`
  - `cd server && node scripts/reassign-admin.js <fromAdminId> <toAdminId>`
  - `node server/scripts/migrate-sqlite-to-supabase.js server/prisma/yappd.db`

## Git Workflow
- `main` is the production branch. Do not do casual work directly on `main`.
- Create one feature branch per small task. Examples: `fix-telegram-webhook`, `attendance-ui-tweak`.
- Test changes locally on the feature branch before merging to `main`.
- Typical flow:
  - `git checkout main`
  - `git pull origin main`
  - `git checkout -b <feature-branch>`
  - make changes
  - run local checks
  - `git add <files>`
  - `git commit -m "<purpose of change>"`
- `git push -u origin <feature-branch>`
- Commit messages should describe one logical change, not one file. Good: `Fix Telegram webhook registration`. Bad: `edit app.jsx`.

## Render Deploy Flow
- Render production deploys come from the GitHub branch configured for the service, normally `main`.
- Local edits on your machine do nothing to production until you commit, push, and Render deploys that branch.
- Feature branches are safe for local work and GitHub backup unless Render is explicitly pointed at them.
- Production secrets and runtime config belong in Render environment variables, not in local `.env` files committed to git.
- After changing Render environment variables, trigger a redeploy or restart so the app starts with the new values.

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
- Prisma datasource config is split across `server/prisma/schema.prisma` and `server/prisma/prisma.config.ts`.
  - Do not add `url =` to the datasource block.
  - Runtime DB config is built from `DATABASE_URL` or the `DB_*` env vars in `server/.env`. See `server/.env.example` for the full Supabase template.
  - Use `DB_USE_LIBPQ_COMPAT=true` with Supabase pooler connections.
- Do not run `prisma migrate` against Supabase. Use `prisma db pull` to sync the schema from the live DB.
- `Division` and `Branch` are normalized tables. Do not reintroduce free-text department fields.
- `Officer.phoneNumber` is required, unique, and must stay normalized through `normalizePhone`.
- Bot sessions are in-memory Maps. Preserve stale-keyboard and message-id guards when changing Telegram flows.
- The dashboard attendance view refreshes both on its own timer and when new officer notification events arrive. Keep those paths aligned.
- Dashboard desktop shell uses `h-[100dvh] overflow-hidden`; inner panels (`OfficerList`, `RosterView`) scroll independently. Do not put overflow on the outer shell.
- There is no server lint script. Do not document or rely on one unless you add it first.
- Render production deploys should come from `main`, not random feature branches.
