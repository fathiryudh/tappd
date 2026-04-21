# Design: Cron Reliability & Digest Email Scoping

**Date:** 2026-04-21  
**Branch:** `fix/cron-reliability-and-email-scoping`

---

## Problem Summary

1. **Cron never fires on Render free tier** — `node-cron` runs inside the Express process which spins down during inactivity. If the server is asleep at 7:30 AM or 8:30 AM SGT, nudges and digest email are silently skipped.

2. **Digest email sends all officers to every admin** — The digest query fetches all officers regardless of which admin is receiving it. OPS admins see PERS officers and vice versa.

---

## Problem 1 — Cron Reliability

### Existing code
- `server/server.js` — two `node-cron` schedules call `getUnreportedOfficers()`, `nudgeOfficers()`, and `sendDailyDigest()` inline
- `server/src/bot/digest.js` — exports `sendDailyDigest(digestEmail)` and `getUnreportedOfficers()`
- `server/src/bot/telegram.js` — exports `nudgeOfficers(officers)`

### Design

**Extract two standalone async functions** in a new `server/src/cron/jobs.js`:

```
runMorningNudge()  — fetch unreported officers → nudge each via Telegram
runDigestEmail()   — for each User with digestEmails (or fallback user.email), build scoped officer list → send digest
```

**Keep `node-cron` schedules in `server/server.js`** calling these functions — useful warm-server fallback.

**Add `server/src/routes/cron.routes.js`** with two POST endpoints:
- `POST /api/v1/cron/nudge`
- `POST /api/v1/cron/digest`

Both endpoints:
- Validate `x-cron-secret` header against `CRON_SECRET` env var → 401 if missing or wrong
- Call the corresponding job function
- Return `{ ok: true }` on success, `{ ok: false, error: message }` on failure
- Never throw — catch all errors and return them (prevents retry storms from cron-job.org)

**Add `CRON_SECRET` to `server/.env.example`** with a comment.

**Mount the cron routes** in `server/src/routes/index.js` without auth middleware (the secret header is the auth).

**Include setup comment block** in `cron.routes.js` for cron-job.org configuration.

---

## Problem 2 — Digest Email Scoping

### Database changes (SQL → `prisma db pull`)

```sql
ALTER TABLE "User"
  ADD COLUMN "scopeDivisionId" text REFERENCES "Division"("id"),
  ADD COLUMN "scopeBranchId"   text REFERENCES "Branch"("id"),
  ADD COLUMN "digestEmails"    text[] NOT NULL DEFAULT '{}';
```

After applying in Supabase: run `cd server && npx prisma db pull && npx prisma generate`.

### API changes

New `server/src/routes/settings.routes.js` (auth-protected):

- `GET /api/v1/settings/scope` → returns `{ scopeDivisionId, scopeBranchId }`
- `PUT /api/v1/settings/scope` → body `{ scopeDivisionId, scopeBranchId }` (either nullable); validates IDs exist in Division/Branch tables
- `GET /api/v1/settings/digest-emails` → returns `{ digestEmails: string[] }`
- `PUT /api/v1/settings/digest-emails` → body `{ digestEmails: string[] }`; validates each is a valid email format

Mount in `server/src/routes/index.js` under `/settings`.

### Digest scoping logic (in `runDigestEmail()`)

For each `User`:
1. Determine recipient list: `user.digestEmails` if non-empty, else `[user.email]`
2. Build officer `where` clause:
   - `scopeDivisionId` set → filter `divisionId: user.scopeDivisionId`
   - `scopeBranchId` set → also filter `branchId: user.scopeBranchId`
   - Both null → no filter (superadmin, all officers)
3. Send scoped digest to each recipient

### Settings page (client)

New route: `/settings` — minimal single-page layout, no tabs.

Two sections:
1. **Department Scope** — Division + Branch dropdowns (same data as `GET /api/v1/officers/form-options`). Auto-save on change via `PUT /api/v1/settings/scope`. Success toast on save. Note: *"The daily digest email will only include officers from the selected division/branch. Leave blank to include all officers."*

2. **Digest Emails** — List of email addresses. Add/remove UI. Save via `PUT /api/v1/settings/digest-emails`. Success toast. Note: *"If no emails are added, the digest is sent to your account email."*

Nav: Add a gear icon link to `Dashboard.jsx` that navigates to `/settings` (a separate page via `useNavigate`). It is NOT added to `NAV_ITEMS` (which switch panels within Dashboard) — it sits alongside them as a standalone navigation action, consistent with where the logout button already lives.

Reuse existing UI primitives from `client/src/components/ui/` and match the Dashboard color palette.

---

## File Inventory

### New files
- `server/src/cron/jobs.js` — `runMorningNudge`, `runDigestEmail`
- `server/src/routes/cron.routes.js` — POST endpoints + cron-job.org comment
- `server/src/routes/settings.routes.js` — scope + digest-emails endpoints
- `client/src/pages/Settings.jsx` — settings page
- `client/src/api/settings.api.js` — API calls

### Modified files
- `server/server.js` — cron schedules call extracted functions
- `server/src/bot/digest.js` — `sendDailyDigest` refactored to accept scoped args
- `server/src/routes/index.js` — mount `/cron` and `/settings` routes
- `server/.env.example` — add `CRON_SECRET`
- `client/src/App.jsx` — add `/settings` route
- `client/src/pages/Dashboard.jsx` — add Settings nav item

---

## Constraints & Notes
- Do not add a Settings nav item that requires a new top-level route for mobile bottom-tab changes beyond what's needed
- `CRON_SECRET` in Render env vars must match the value configured in cron-job.org headers
- `runDigestEmail()` must not use `process.env.DIGEST_EMAIL` — that env var is retired in favour of per-User `digestEmails`
- `node-cron` schedules are kept as a warm-server fallback; do not remove them
- All Prisma queries use `async/await`; no `.then()` chains
- Date handling uses SGT via helpers in `server/src/utils/date.js`
