# Bot Enhancements Design — Sub-project A

**Date:** 2026-04-15
**Goal:** Add `/roster` to BotFather command menu, add "View Roster" to the reply keyboard, and enable officers to edit all profile fields via a `/editprofile` command in the bot.

---

## Scope

Three changes to `server/src/bot/telegram.js` only — no DB migrations, no frontend changes:

1. Register bot commands with Telegram via `bot.setMyCommands()` at startup
2. Add "View Roster" button to the persistent reply keyboard
3. Implement `/editprofile` command with a sequential field-edit flow

---

## 1. BotFather Command Menu

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

## 2. Reply Keyboard Update

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

`handleRosterCommand` already exists and is fully implemented — it fetches today's roster from the DB, groups officers by branch, and sends a formatted text message.

---

## 3. `/editprofile` Command — Self-Edit Flow

### Session Map

Add a new module-level Map alongside `sessions` and `weekSessions`:

```js
const editSessions = new Map()
// keyed by telegramId (string)
// value: { field: 'name'|'rank'|'dept'|'phone'|null, messageId: number|null, chatId: number }
```

### Entry Points

- `/editprofile` command → `handleCommand` dispatches to `handleEditProfileCommand(msg)`
- `handleMessage` catches text input when `editSessions.has(telegramId)` and the session's `field` is set to `'name'`, `'rank'`, or `'dept'` (typed fields)
- `handleMessage` catches contact messages when `editSessions.get(telegramId)?.field === 'phone'`

### Profile Card Keyboard

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
      [{ text: '✅ Done', callback_data: 'edit_done' }],
    ],
  }
}
```

### Profile Card Text

```js
function buildProfileText(officer) {
  const name     = officer.name         || '(not set)'
  const rank     = officer.rank         || '(not set)'
  const division = officer.division     || '(not set)'
  const branch   = officer.branch       || '(not set)'
  const phone    = officer.phoneNumber  || '(not set)'
  return `👤 Your profile:\n\nName: ${name}\nRank: ${rank}\nDivision: ${division}\nBranch: ${branch}\nPhone: ${phone}\n\nWhat would you like to update?`
}
```

### Flow Walkthrough

```
Officer sends /editprofile
  ↓
handleEditProfileCommand:
  - fetch officer (if not found → promptVerification)
  - clear any existing editSession
  - send profile card with editProfileKeyboard()
  - store editSession: { field: null, messageId: sent.message_id, chatId }

Officer taps [✏️ Name] (callback_data: 'edit_name')
  ↓
handleCallbackQuery:
  - verify editSession.messageId === messageId (else → "keyboard expired")
  - set editSession.field = 'name'
  - editMessageText: "What's your new name? Type it below."
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }

Officer types "CPT John Tan"
  ↓
handleMessage (editSessions check at top of typed-input section):
  - validate: non-empty, ≤ 60 chars, strip whitespace
  - prisma.officer.update({ name: 'CPT John Tan' })
  - re-fetch officer
  - editSession.field = null
  - editMessageText(editSession.messageId): buildProfileText(updated) + editProfileKeyboard()
    → "Updated! Here's your profile:"  (profile card loops back)
  (same flow applies for edit_rank → officer.rank, edit_division → officer.division, edit_branch → officer.branch)

Officer taps [✏️ Phone] (callback_data: 'edit_phone')
  ↓
handleCallbackQuery:
  - set editSession.field = 'phone'
  - editMessageText: "Share your new phone number to update it."
    reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] }
  - send SEPARATE message with contact keyboard (Telegram requires ReplyKeyboardMarkup in its own message):
      bot.sendMessage(chatId, "Tap below to share your number:", { reply_markup: contactKeyboard() })

Officer shares contact
  ↓
handleMessage (contact message branch):
  - check editSession exists and editSession.field === 'phone' (else → normal registration flow)
  - normalise phone (normalizePhone from officers.controller)
  - check not taken by another officer:
      prisma.officer.findFirst({ where: { phoneNumber: phone, NOT: { id: officer.id } } })
    → if taken: "That number is linked to another account. No changes made."
  - prisma.officer.update({ phoneNumber: phone })
  - re-fetch officer
  - send new message with remove_keyboard: true to dismiss the contact keyboard
  - editSession.field = null
  - editMessageText(editSession.messageId): buildProfileText(updated) + editProfileKeyboard()

Officer taps [✅ Done] (callback_data: 'edit_done')
  ↓
handleCallbackQuery:
  - editSessions.delete(telegramId)
  - editMessageText: "Profile saved. All good! 👍"
    reply_markup: { inline_keyboard: [] }

Officer taps [❌ Cancel] mid-edit (callback_data: 'edit_cancel')
  ↓
handleCallbackQuery:
  - editSession.field = null
  - re-fetch officer
  - if previous field was 'phone': send a message with remove_keyboard: true to dismiss the contact keyboard
  - editMessageText: buildProfileText(officer) + editProfileKeyboard()
    → returns to profile card without saving
```

### Validation Rules

| Field | DB column | Rule |
|---|---|---|
| Name | `officer.name` | Non-empty after trim, ≤ 60 chars |
| Rank | `officer.rank` | Non-empty after trim, ≤ 20 chars |
| Division | `officer.division` | Non-empty after trim, ≤ 60 chars |
| Branch | `officer.branch` | Non-empty after trim, ≤ 60 chars |
| Phone | `officer.phoneNumber` | normalizePhone() succeeds, not already taken by a different officer |

On validation failure: send a new message with the error and re-prompt the same field.

### Callback Prefixes Added

`edit_name`, `edit_rank`, `edit_division`, `edit_branch`, `edit_phone`, `edit_done`, `edit_cancel`

---

## Session Isolation

- Opening `/editprofile` clears any existing `editSession` for that telegramId
- Opening `/editprofile` does NOT clear `sessions` or `weekSessions` — those flows are independent
- `editSessions` is included in `setupMocks()` in `helpers.js` so tests get fresh state per test

---

## Error Handling

- Officer not registered → `promptVerification(chatId)`
- NSF officer → allowed to edit profile (NSFs can still update their name/rank/dept/phone)
- `editSession.messageId` mismatch → "This keyboard has expired." (same guard as other flows)
- DB errors → propagate via `express-async-errors` pattern (caught by global error handler)

---

## Files Changed

- **Modify:** `server/src/bot/telegram.js`
  - Add `editSessions` Map
  - Update `replyKeyboardMarkup()`
  - Add `setMyCommands()` call at startup
  - Add `'View Roster'` text handler in `handleMessage`
  - Add `editProfileKeyboard()` and `buildProfileText()` helpers
  - Add `handleEditProfileCommand()` function
  - Add `edit_*` callback handlers in `handleCallbackQuery`
  - Add edit-session text-input handling in `handleMessage`
  - Add edit-session contact handling in `handleMessage`

No DB migrations needed — all fields (`name`, `rank`, `department`, `phone`) already exist on the `Officer` model.

---

## Out of Scope

- Changing `telegramId` or `isNSF` — not editable by the officer
- Admin editing officer profiles from the dashboard — existing functionality, untouched
- Frontend changes
- Any changes to `digest.js`, `parser.js`, or routes
