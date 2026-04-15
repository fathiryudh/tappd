# Bot Enhancements Design — Sub-project A

**Date:** 2026-04-15
**Goal:** Add `/roster` to BotFather command menu, add "View Roster" to the reply keyboard, introduce `Division` and `Branch` as proper DB tables, and enable officers to edit all profile fields via a `/editprofile` command in the bot.

---

## Scope

Changes span the DB schema, a seed script, and the bot:

1. DB migration — `Division` and `Branch` models; `Officer` gets `divisionId` and `branchId` FKs replacing the old `division String?` and `branch String?` columns
2. Seed script — populate 5 known SCDF divisions
3. Register bot commands with Telegram via `bot.setMyCommands()` at startup
4. Add "View Roster" button to the persistent reply keyboard
5. Implement `/editprofile` command with a sequential field-edit flow

No frontend changes in this sub-project.

---

## 1. Schema Changes

### New models

```prisma
model Division {
  id       String    @id @default(cuid())
  name     String    @unique
  officers Officer[]
}

model Branch {
  id       String    @id @default(cuid())
  name     String    @unique
  officers Officer[]
}
```

### Officer model changes

Remove `division String?` and `branch String?`. Add:

```prisma
model Officer {
  // ... existing fields ...
  divisionId String?
  division   Division? @relation(fields: [divisionId], references: [id])
  branchId   String?
  branch     Branch?   @relation(fields: [branchId], references: [id])
}
```

Both relations are optional — an officer without a division or branch is valid.

### Migration

```bash
cd server && npx prisma migrate dev --name add_division_branch_tables
```

### Seed script — `server/prisma/seed-divisions.js`

```js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const DIVISIONS = [
  '1st Div',
  '2nd Div',
  '3rd Div',
  '4th Div',
  'Marine Division',
  'SCDF HQ',
]

async function main() {
  for (const name of DIVISIONS) {
    await prisma.division.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('Divisions seeded.')
}

main().finally(() => prisma.$disconnect())
```

Run once after migration: `node prisma/seed-divisions.js`

---

## 2. BotFather Command Menu

Call `bot.setMyCommands()` once at server startup (after the bot is initialised). Registers the following commands so they appear in Telegram's `/` command picker:

| Command | Description |
|---|---|
| `/start` | Register or view welcome |
| `/roster` | View today's roster |
| `/editprofile` | Edit your profile |
| `/deregister` | Remove your profile |

**Where:** Called at the bottom of `telegram.js`, after `const bot = new TelegramBot(...)`, inside an immediately-invoked async block so failures don't crash the module.

```js
;(async () => {
  try {
    await bot.setMyCommands([
      { command: 'start',       description: 'Register or view welcome' },
      { command: 'roster',      description: 'View today\'s roster' },
      { command: 'editprofile', description: 'Edit your profile' },
      { command: 'deregister',  description: 'Remove your profile' },
    ])
  } catch (e) {
    console.warn('[BOT] setMyCommands failed:', e.message)
  }
})()
```

---

## 3. Reply Keyboard Update

### Current layout (2×2)
```
[ Report Today  ] [ Plan This Week  ]
[ Plan Next Week ] [ My Status       ]
```

### New layout (2×2 + full-width row)
```
[ Report Today  ] [ Plan This Week  ]
[ Plan Next Week ] [ My Status       ]
[ View Roster                        ]
```

### Change to `replyKeyboardMarkup()`

```js
function replyKeyboardMarkup() {
  return {
    keyboard: [
      [{ text: 'Report Today' }, { text: 'Plan This Week' }],
      [{ text: 'Plan Next Week' }, { text: 'My Status' }],
      [{ text: 'View Roster' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}
```

### Handler in `handleMessage`

Add a text match for `'View Roster'` that delegates to the existing `/roster` command logic:

```js
if (rawMessage === 'View Roster') {
  await handleRosterCommand(msg)
  return
}
```

`handleRosterCommand` already exists and is fully implemented — it fetches today's roster from the DB, groups officers by branch, and sends a formatted text message. It must be updated to query via the `branch` relation (`include: { branch: true, division: true }`) and use `officer.branch.name` / `officer.division.name` instead of the old string fields.

---

## 4. `/editprofile` Command — Self-Edit Flow

### Session Map

Add a new module-level Map alongside `sessions` and `weekSessions`:

```js
const editSessions = new Map()
// keyed by telegramId (string)
// value: { field: 'name'|'rank'|'division'|'branch'|'phone'|null, messageId: number|null, chatId: number }
```

### Entry Points

- `/editprofile` command → `handleCommand` dispatches to `handleEditProfileCommand(msg)`
- `handleMessage` catches text input when `editSessions.has(telegramId)` and `editSession.field` is `'name'`, `'rank'`, `'division'`, or `'branch'` (typed fields — triggered after tapping "Other")
- `handleMessage` catches contact messages when `editSession.field === 'phone'`

### Profile Card Helpers

```js
function editProfileKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✏️ Name',     callback_data: 'edit_name' },
        { text: '✏️ Rank',     callback_data: 'edit_rank' },
      ],
      [
        { text: '✏️ Division', callback_data: 'edit_division' },
        { text: '✏️ Branch',   callback_data: 'edit_branch' },
      ],
      [{ text: '✏️ Phone', callback_data: 'edit_phone' }],
      [{ text: '✅ Done',  callback_data: 'edit_done'  }],
    ],
  }
}

function buildProfileText(officer) {
  const name     = officer.name              || '(not set)'
  const rank     = officer.rank              || '(not set)'
  const division = officer.division?.name    || '(not set)'
  const branch   = officer.branch?.name      || '(not set)'
  const phone    = officer.phoneNumber       || '(not set)'
  return (
    `👤 Your profile:\n\n` +
    `Name: ${name}\nRank: ${rank}\nDivision: ${division}\nBranch: ${branch}\nPhone: ${phone}\n\n` +
    `What would you like to update?`
  )
}
```

`officer` must be fetched with `include: { division: true, branch: true }` wherever it is used in this flow.

### Division Selection Keyboard

Division shows all known divisions plus an "Other" option — same pattern as Branch. This keeps the system future-proof if new SCDF divisions are created.

```js
async function divisionKeyboard() {
  const divisions = await prisma.division.findMany({ orderBy: { name: 'asc' } })
  const rows = divisions.map(d => [{ text: d.name, callback_data: `edit_div:${d.id}` }])
  rows.push([{ text: '✏️ Other (type it)', callback_data: 'edit_division_other' }])
  rows.push([{ text: '❌ Cancel',           callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}
```

Callback prefixes: `edit_div:<divisionId>`, `edit_division_other`

When officer selects a known division → update Officer directly.
When officer taps "Other" → `editSession.field = 'division'` → bot prompts to type it → `prisma.division.upsert({ where: { name }, create: { name }, update: {} })` → link to officer.

### Branch Selection Keyboard

Branch shows all existing branches plus an "Other" option that lets the officer type a new one.

```js
async function branchKeyboard() {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } })
  const rows = branches.map(b => [{ text: b.name, callback_data: `edit_br:${b.id}` }])
  rows.push([{ text: '✏️ Other (type it)', callback_data: 'edit_branch_other' }])
  rows.push([{ text: '❌ Cancel',           callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}
```

Callback prefixes: `edit_br:<branchId>`, `edit_branch_other`

When officer selects an existing branch → update Officer directly.
When officer taps "Other" → `editSession.field = 'branch'` → bot prompts to type it → `prisma.branch.upsert({ where: { name }, create: { name }, update: {} })` → link to officer.

### Flow Walkthrough

```
Officer sends /editprofile
  ↓
handleEditProfileCommand:
  - fetch officer with include: { division: true, branch: true }
    (if not found → promptVerification)
  - clear any existing editSession
  - send profile card with editProfileKeyboard()
  - store editSession: { field: null, messageId: sent.message_id, chatId }

── Editing name / rank ──────────────────────────────────────────────

Officer taps [✏️ Name] (callback_data: 'edit_name')
  - verify editSession.messageId === messageId (else → "keyboard expired")
  - editSession.field = 'name'
  - editMessageText: "What's your new name? Type it below."
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }

Officer types "CPT John Tan"
  - validate: non-empty after trim, ≤ 60 chars
  - prisma.officer.update({ name: trimmed })
  - re-fetch officer (with includes)
  - editSession.field = null
  - editMessageText(editSession.messageId): "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()
  (same pattern for edit_rank → officer.rank, max 20 chars)

── Editing division ─────────────────────────────────────────────────

Officer taps [✏️ Division] (callback_data: 'edit_division')
  - editSession.field = 'division'
  - editMessageText: "Choose your division:"
    reply_markup: await divisionKeyboard()

Officer taps a known division (callback_data: 'edit_div:<id>')
  - prisma.officer.update({ divisionId: id })
  - re-fetch officer (with includes)
  - editSession.field = null
  - editMessageText: "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()

Officer taps [✏️ Other (type it)] (callback_data: 'edit_division_other')
  - editSession.field = 'division'   (already set — keep it)
  - editMessageText: "Type your division name:"
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }

Officer types "5th Division"
  - validate: non-empty after trim, ≤ 60 chars
  - prisma.division.upsert({ where: { name: '5th Division' }, create: { name: '5th Division' }, update: {} })
  - prisma.officer.update({ divisionId: division.id })
  - re-fetch officer (with includes)
  - editSession.field = null
  - editMessageText: "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()

── Editing branch ───────────────────────────────────────────────────

Officer taps [✏️ Branch] (callback_data: 'edit_branch')
  - editSession.field = 'branch'
  - editMessageText: "Choose your branch or type a new one:"
    reply_markup: await branchKeyboard()

Officer taps an existing branch (callback_data: 'edit_br:<id>')
  - prisma.officer.update({ branchId: id })
  - re-fetch officer (with includes)
  - editSession.field = null
  - editMessageText: "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()

Officer taps [✏️ Other (type it)] (callback_data: 'edit_branch_other')
  - editSession.field = 'branch'   (already set — keep it)
  - editMessageText: "Type your branch name:"
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }

Officer types "G3 OPS"
  - validate: non-empty after trim, ≤ 60 chars
  - prisma.branch.upsert({ where: { name: 'G3 OPS' }, create: { name: 'G3 OPS' }, update: {} })
  - prisma.officer.update({ branchId: branch.id })
  - re-fetch officer (with includes)
  - editSession.field = null
  - editMessageText: "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()

── Editing phone ────────────────────────────────────────────────────

Officer taps [✏️ Phone] (callback_data: 'edit_phone')
  - editSession.field = 'phone'
  - editMessageText: "Share your new phone number to update it."
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }
  - bot.sendMessage(chatId, "Tap below:", { reply_markup: contactKeyboard() })
    (separate message — Telegram requires ReplyKeyboardMarkup in its own message)

Officer shares contact
  - check editSession.field === 'phone' (else → normal registration flow)
  - normalise via normalizePhone()
  - prisma.officer.findFirst({ where: { phoneNumber: phone, NOT: { id: officer.id } } })
    → if taken: send error message "That number is already linked to another account."
  - prisma.officer.update({ phoneNumber: phone })
  - re-fetch officer (with includes)
  - bot.sendMessage(chatId, "✅ Phone updated.", { reply_markup: { remove_keyboard: true } })
  - editSession.field = null
  - editMessageText(editSession.messageId): "Updated! Here's your profile:\n\n" + buildProfileText(officer)
    reply_markup: editProfileKeyboard()

── Done / Cancel ────────────────────────────────────────────────────

Officer taps [✅ Done] (callback_data: 'edit_done')
  - editSessions.delete(telegramId)
  - editMessageText: "Profile saved. All done! 👍"
    reply_markup: { inline_keyboard: [] }

Officer taps [❌ Cancel] (callback_data: 'edit_cancel')
  - prevField = editSession.field
  - editSession.field = null
  - re-fetch officer (with includes)
  - if prevField === 'phone':
      bot.sendMessage(chatId, "Cancelled.", { reply_markup: { remove_keyboard: true } })
  - editMessageText: buildProfileText(officer)
    reply_markup: editProfileKeyboard()
    → returns to profile card without saving
```

### Validation Rules

| Field | DB column | Rule |
|---|---|---|
| Name | `officer.name` | Non-empty after trim, ≤ 60 chars |
| Rank | `officer.rank` | Non-empty after trim, ≤ 20 chars |
| Division (existing) | `officer.divisionId` | Must be a valid Division id (selected from keyboard) |
| Division (new) | `officer.divisionId` | Created via upsert — non-empty after trim, ≤ 60 chars |
| Branch (new) | `officer.branchId` | Created via upsert — non-empty after trim, ≤ 60 chars |
| Branch (existing) | `officer.branchId` | Must be a valid Branch id (selected from keyboard) |
| Phone | `officer.phoneNumber` | normalizePhone() succeeds, not already taken by a different officer |

On typed validation failure: send a new message with the error and re-prompt the same field (don't touch the profile card message).

### Callback Prefixes Added

`edit_name`, `edit_rank`, `edit_division`, `edit_div:<id>`, `edit_division_other`, `edit_branch`, `edit_br:<id>`, `edit_branch_other`, `edit_phone`, `edit_done`, `edit_cancel`

---

## Session Isolation

- Opening `/editprofile` clears any existing `editSession` for that `telegramId`
- Opening `/editprofile` does NOT clear `sessions` or `weekSessions` — those flows are independent
- `editSessions` is included in `setupMocks()` in `helpers.js` so tests get fresh state per test

---

## Roster Command Updates

`handleRosterCommand` must be updated to use the new relations:

```js
// Before (old string fields)
const officers = await prisma.officer.findMany({
  where,
  include: { availability: { where: { date: today }, take: 1 } },
  orderBy: [{ branch: 'asc' }, { name: 'asc' }],
})
// officer.branch  (string)
// officer.division (string)

// After (relation fields)
const officers = await prisma.officer.findMany({
  where,
  include: {
    availability: { where: { date: today }, take: 1 },
    branch: true,
    division: true,
  },
  orderBy: [{ name: 'asc' }],
})
// officer.branch.name  (string | undefined)
// officer.division.name (string | undefined)
```

The `where` clause used to filter by `division` (string) must change to `divisionId`. The `targetDivision` lookup fetches the Division record by name first, then filters by `divisionId`.

---

## Error Handling

- Officer not registered → `promptVerification(chatId)`
- NSF officer → allowed to edit all profile fields
- `editSession.messageId` mismatch → "This keyboard has expired."
- DB errors → propagate (caught by global error handler)

---

## Files Changed

- **New:** `server/prisma/seed-divisions.js`
- **Migration:** `server/prisma/migrations/<timestamp>_add_division_branch_tables/`
- **Modify:** `server/prisma/schema.prisma` — add `Division`, `Branch` models; update `Officer`
- **Modify:** `server/src/bot/telegram.js`
  - Add `editSessions` Map
  - Update `replyKeyboardMarkup()`
  - Add `setMyCommands()` call at startup
  - Add `'View Roster'` text handler in `handleMessage`
  - Add `editProfileKeyboard()`, `buildProfileText()`, `divisionKeyboard()`, `branchKeyboard()` helpers
  - Add `handleEditProfileCommand()` function
  - Add `edit_*` callback handlers in `handleCallbackQuery`
  - Add edit-session text-input and contact handling in `handleMessage`
  - Update `handleRosterCommand()` to use relation fields

---

## Out of Scope

- Changing `telegramId` or `role` (NSF/OFFICER) — not editable by the officer
- Admin dashboard CRUD for divisions or branches — divisions are seeded; branches grow via officer input
- Any changes to `digest.js`, `parser.js`, or routes
- Frontend changes
