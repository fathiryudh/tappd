# Bot Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Division/Branch DB tables, a "View Roster" reply keyboard button, BotFather command menu, and a `/editprofile` command that lets officers update all profile fields via the bot.

**Architecture:** Division and Branch become proper Prisma models with FK relations on Officer. The bot gains a new `editSessions` Map and sequential field-edit flow for `/editprofile`. All existing bot session patterns (messageId guard, keyboard clearing) are reused for the new flow.

**Tech Stack:** Prisma 7 + SQLite, node-telegram-bot-api, Jest (CommonJS, no transform)

---

## Task 1: Schema — Division and Branch models

**Files:**
- Modify: `server/prisma/schema.prisma`
- Auto-create: `server/prisma/migrations/<timestamp>_add_division_branch_tables/`

- [ ] **Step 1: Open `server/prisma/schema.prisma` and replace the Officer model and add two new models**

The current Officer model has `division String?` and `branch String?`. Replace the entire file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  refreshToken  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  officers      Officer[]
}

enum AvailabilityStatus {
  IN
  OUT
}

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

model Officer {
  id           String         @id @default(cuid())
  telegramId   String?        @unique
  telegramName String?
  phoneNumber  String         @unique
  name         String?
  rank         String?
  role         String         @default("OFFICER")
  divisionId   String?
  division     Division?      @relation(fields: [divisionId], references: [id])
  branchId     String?
  branch       Branch?        @relation(fields: [branchId], references: [id])
  adminId      String?
  admin        User?          @relation(fields: [adminId], references: [id], onDelete: SetNull)
  availability Availability[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([adminId])
  @@index([divisionId])
}

model Availability {
  id         String             @id @default(cuid())
  officerId  String
  officer    Officer            @relation(fields: [officerId], references: [id], onDelete: Cascade)
  date       DateTime
  status     AvailabilityStatus
  reason     String?
  rawMessage String
  notes      String?
  splitDay   Boolean            @default(false)
  createdAt  DateTime           @default(now())

  @@unique([officerId, date])
  @@index([officerId])
  @@index([date])
}
```

- [ ] **Step 2: Run the migration**

```bash
cd server && npx prisma migrate dev --name add_division_branch_tables
```

Expected: Migration created and applied. Prisma client regenerated.

> **Note:** Existing `division` and `branch` string data on Officer rows is dropped. Officers will re-set their division/branch via `/editprofile` after this migration. This is acceptable for dev.

- [ ] **Step 3: Verify the schema generated correctly**

```bash
cd server && npx prisma studio
```

Confirm Division and Branch tables exist. Confirm Officer has `divisionId` and `branchId` columns (no `division` or `branch` string columns).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add Division and Branch models with FK relations on Officer"
```

---

## Task 2: Seed the 6 known SCDF divisions

**Files:**
- Create: `server/prisma/seed-divisions.js`

- [ ] **Step 1: Create `server/prisma/seed-divisions.js`**

```js
'use strict'
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
    console.log(`Seeded: ${name}`)
  }
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the seed**

```bash
cd server && node prisma/seed-divisions.js
```

Expected output:
```
Seeded: 1st Div
Seeded: 2nd Div
Seeded: 3rd Div
Seeded: 4th Div
Seeded: Marine Division
Seeded: SCDF HQ
Done.
```

- [ ] **Step 3: Commit**

```bash
git add server/prisma/seed-divisions.js
git commit -m "feat: seed 6 SCDF divisions"
```

---

## Task 3: Update test helpers for the new Officer shape

**Files:**
- Modify: `server/tests/bot/helpers.js`

The `makeOfficer()` stub currently returns `{ division: '2nd Div', branch: 'Ops' }` (strings). After the schema change the bot code uses `officer.division?.name` and `officer.branch?.name` (relation objects). The prisma mock also needs `division` and `branch` stubs for `divisionKeyboard()` and `branchKeyboard()`.

- [ ] **Step 1: Update `makeOfficer()` and `setupMocks()` in `server/tests/bot/helpers.js`**

Replace the entire file:

```js
// server/tests/bot/helpers.js
'use strict'

/** Build a private text message from a user */
function makeMsg(telegramId, text, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    text,
  }
}

/** Build an inline keyboard callback query */
function makeCallback(telegramId, messageId, data, chatId = 100) {
  return {
    id: 'cbq_' + Math.random().toString(36).slice(2),
    from: { id: parseInt(telegramId) },
    message: {
      message_id: messageId,
      chat: { id: chatId, type: 'private' },
    },
    data,
  }
}

/** Build a slash command message */
function makeCommandMsg(telegramId, text, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    text,
  }
}

/** Build a contact-sharing message (phone verification) */
function makeContactMsg(telegramId, phone, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    contact: { user_id: parseInt(telegramId), phone_number: phone },
  }
}

/** Build a group chat message (should be rejected by bot) */
function makeGroupMsg(telegramId, text, chatId = 200) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'group' },
    text,
  }
}

/** Default registered officer stub — override any field with overrides.
 *  division and branch are relation objects (matching Prisma include shape).
 */
function makeOfficer(overrides = {}) {
  return {
    id: 'off_1',
    telegramId: '100',
    telegramName: 'testuser',
    name: 'Test Officer',
    rank: 'CPT',
    role: null,
    divisionId: 'div_1',
    division: { id: 'div_1', name: '2nd Div' },
    branchId: 'br_1',
    branch: { id: 'br_1', name: 'Ops' },
    phoneNumber: '+6591234567',
    adminId: 'adm_1',
    availability: [],
    ...overrides,
  }
}

/**
 * Call this in beforeEach. Returns { bot, prisma, handlers }.
 * Uses jest.resetModules() + jest.doMock() so telegram.js reloads
 * with empty session Maps on every test.
 */
function setupMocks(officerOverrides = {}) {
  jest.resetModules()

  let msgIdSeq = 0

  const bot = {
    sendMessage: jest.fn().mockImplementation(() =>
      Promise.resolve({ message_id: ++msgIdSeq })
    ),
    editMessageText: jest.fn().mockResolvedValue({}),
    editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    setMyCommands: jest.fn().mockResolvedValue({}),
  }

  const officer = makeOfficer(officerOverrides)

  const prisma = {
    officer: {
      findUnique: jest.fn().mockResolvedValue(officer),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(officer),
      delete: jest.fn().mockResolvedValue(officer),
      create: jest.fn().mockResolvedValue(officer),
    },
    availability: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    division: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'div_1', name: '2nd Div' },
        { id: 'div_2', name: 'SCDF HQ' },
      ]),
      findFirst: jest.fn().mockResolvedValue({ id: 'div_1', name: '2nd Div' }),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'div_new', ...create })),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'br_1', name: 'Ops' },
      ]),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'br_new', ...create })),
    },
  }

  jest.doMock('node-telegram-bot-api', () => jest.fn(() => bot))
  jest.doMock('../../src/config/prisma', () => prisma)

  const handlers = require('../../src/bot/telegram')

  return { bot, prisma, handlers }
}

module.exports = {
  makeMsg,
  makeCallback,
  makeCommandMsg,
  makeContactMsg,
  makeGroupMsg,
  makeOfficer,
  setupMocks,
}
```

- [ ] **Step 2: Run existing tests to confirm no regressions from helper shape change**

```bash
cd server && npm test
```

Expected: All existing tests pass. (The mocked officer now has `division: { id, name }` — if any existing test string-compares `officer.division` the test will need a fix, but telegram.js hasn't changed yet so no bot code runs against the new shape yet.)

- [ ] **Step 3: Commit**

```bash
git add server/tests/bot/helpers.js
git commit -m "test: update helpers for Division/Branch relation shape"
```

---

## Task 4: Update telegram.js for relation fields + View Roster + setMyCommands

**Files:**
- Modify: `server/src/bot/telegram.js`

This task makes six targeted changes to the existing bot code. None add new features — they fix code that used to read `officer.division` (string) to now read `officer.division?.name`, update the roster query for relations, add View Roster handling, and register commands at startup.

- [ ] **Step 1: Add `setMyCommands()` call after `const bot = new TelegramBot(...)`**

After line 6 (`const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)`), add:

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

- [ ] **Step 2: Add "View Roster" row to `replyKeyboardMarkup()`**

Replace the current `replyKeyboardMarkup()` function:

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

- [ ] **Step 3: Update `handleRosterCommand` for relation fields**

Replace the entire `handleRosterCommand` function (currently lines ~695–789):

```js
async function handleRosterCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true },
  })
  if (!officer) {
    await bot.sendMessage(chatId, "Not registered. Send /start to get started.")
    return
  }

  const todayISO = localISODate()
  const today = new Date(todayISO)

  // Parse optional division argument: /roster 2nd Div
  // Only extract args when called from a /roster command (not from 'View Roster' button)
  const args = (msg.text || '').startsWith('/roster')
    ? (msg.text || '').replace(/^\/roster\s*/i, '').trim()
    : ''

  let targetDivisionName
  if (officer.role === 'NSF') {
    targetDivisionName = officer.division?.name || null
  } else if (args) {
    targetDivisionName = args
  } else {
    targetDivisionName = officer.division?.name || null
  }

  const where = {}
  if (targetDivisionName) {
    const div = await prisma.division.findFirst({
      where: { name: { contains: targetDivisionName } },
    })
    if (!div) {
      await bot.sendMessage(chatId,
        `No division found matching "${targetDivisionName}".`,
        { reply_markup: replyKeyboardMarkup() }
      )
      return
    }
    where.divisionId = div.id
  }

  const officers = await prisma.officer.findMany({
    where,
    include: {
      availability: { where: { date: today }, take: 1 },
      branch: true,
      division: true,
    },
    orderBy: [{ name: 'asc' }],
  })

  if (officers.length === 0) {
    await bot.sendMessage(chatId, targetDivisionName
      ? `No officers found for ${targetDivisionName}.`
      : 'No officers found.',
      { reply_markup: replyKeyboardMarkup() }
    )
    return
  }

  let countIn = 0, countOut = 0, countNotReported = 0
  const reasonCounts = {}
  for (const o of officers) {
    const avail = o.availability[0]
    if (!avail) { countNotReported++; continue }
    if (avail.status === 'IN') { countIn++; continue }
    countOut++
    if (avail.reason) reasonCounts[avail.reason] = (reasonCounts[avail.reason] || 0) + 1
  }

  const reasonSummary = Object.entries(reasonCounts).map(([r, c]) => `${r}×${c}`).join(', ')
  const outStr = countOut > 0 && reasonSummary ? `OUT: ${countOut} (${reasonSummary})` : `OUT: ${countOut}`

  const d = new Date(todayISO)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()} (${dayNames[d.getDay()]})`
  const divLabel = targetDivisionName || 'All Divisions'

  let text = `📋 Roster — ${dateStr}\n${divLabel}\nIN: ${countIn} | ${outStr} | Not reported: ${countNotReported}\n`

  const branches = {}
  for (const o of officers) {
    const br = o.branch?.name || 'Unassigned'
    if (!branches[br]) branches[br] = []
    branches[br].push(o)
  }

  for (const [branchName, branchOfficers] of Object.entries(branches)) {
    text += `\n— ${branchName} —\n`
    for (const o of branchOfficers) {
      const displayName = o.name || o.telegramName || 'Unknown'
      const avail = o.availability[0]
      if (!avail) {
        text += `⚠️ ${displayName} — Not reported\n`
      } else if (avail.status === 'IN') {
        if (avail.notes && avail.notes.includes('AM')) {
          text += `↔️ ${displayName} — ${formatRecordPlain(avail)}\n`
        } else {
          text += `✅ ${displayName} — IN\n`
        }
      } else {
        const reasonStr = avail.reason ? ` (${avail.reason})` : ''
        text += `❌ ${displayName} — OUT${reasonStr}\n`
      }
    }
  }

  await bot.sendMessage(chatId, text, { reply_markup: replyKeyboardMarkup() })
}
```

- [ ] **Step 4: Update `handleContactVerification` — replace `officer.division` with `officer.division?.name`**

In `handleContactVerification`, the officer is fetched without include. Add `include: { division: true }` and update `divInfo`:

Find this fetch:
```js
const officer = await prisma.officer.findFirst({
  where: { phoneNumber: phone },
})
```

Replace with:
```js
const officer = await prisma.officer.findFirst({
  where: { phoneNumber: phone },
  include: { division: true },
})
```

Find:
```js
const divInfo = officer.division ? ` for ${officer.division}` : ''
```

Replace with:
```js
const divInfo = officer.division?.name ? ` for ${officer.division.name}` : ''
```

- [ ] **Step 5: Update `handleCommand` — replace `officer.division` with `officer.division?.name` in `/start`**

In `handleCommand`, find the `/start` block that fetches the officer. Add `include: { division: true }` to the findUnique call:

```js
const existing = await prisma.officer.findUnique({
  where: { telegramId },
  include: { division: true },
})
```

Find:
```js
const divInfo = existing.division ? ` — ${existing.division}` : ''
```

Replace with:
```js
const divInfo = existing.division?.name ? ` — ${existing.division.name}` : ''
```

- [ ] **Step 6: Add 'View Roster' handler in `handleMessage`**

In the "Reply Keyboard button taps" section (after the `rawMessage === 'My Status'` block, before the week session check), add:

```js
if (rawMessage === 'View Roster') {
  await handleRosterCommand(msg)
  return
}
```

- [ ] **Step 7: Run all tests**

```bash
cd server && npm test
```

Expected: All existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/bot/telegram.js
git commit -m "feat: View Roster keyboard button, setMyCommands, relation field updates"
```

---

## Task 5: Write failing tests for /editprofile

**Files:**
- Create: `server/tests/bot/editprofile.test.js`

Write all tests before implementing. They will fail until Tasks 6–9 are complete.

- [ ] **Step 1: Create `server/tests/bot/editprofile.test.js`**

```js
// server/tests/bot/editprofile.test.js
'use strict'
const { setupMocks, makeCommandMsg, makeMsg, makeContactMsg, makeCallback, makeOfficer } = require('./helpers')

describe('/editprofile — open profile card', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('sends profile card with edit buttons', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    expect(bot.sendMessage).toHaveBeenCalledWith(
      100,
      expect.stringContaining('Your profile'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      })
    )
    const keyboard = bot.sendMessage.mock.calls[0][2].reply_markup.inline_keyboard
    const allData = keyboard.flat().map(b => b.callback_data)
    expect(allData).toContain('edit_name')
    expect(allData).toContain('edit_rank')
    expect(allData).toContain('edit_division')
    expect(allData).toContain('edit_branch')
    expect(allData).toContain('edit_phone')
    expect(allData).toContain('edit_done')
  })

  test('profile card shows current values', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const text = bot.sendMessage.mock.calls[0][1]
    expect(text).toContain('Test Officer')
    expect(text).toContain('CPT')
    expect(text).toContain('2nd Div')
    expect(text).toContain('Ops')
    expect(text).toContain('+6591234567')
  })

  test('unregistered user gets verification prompt', async () => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)
    await handlers.handleCommand(makeCommandMsg('999', '/editprofile'))
    expect(bot.sendMessage).toHaveBeenCalledWith(
      100,
      expect.stringContaining('verify'),
      expect.anything()
    )
  })
})

describe('/editprofile — edit name', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Name prompts to type name', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    expect(bot.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('name'),
      expect.objectContaining({ chat_id: 100, message_id: msgId })
    )
  })

  test('typing new name updates officer and shows profile card', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleMessage(makeMsg('100', 'ME2 Ali Hassan'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'ME2 Ali Hassan' }) })
    )
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('Your profile'),
      expect.objectContaining({ message_id: msgId })
    )
  })

  test('empty name is rejected with error message', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleMessage(makeMsg('100', '   '))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenLastCalledWith(100, expect.stringContaining('empty'))
  })
})

describe('/editprofile — edit rank', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('typing new rank updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_rank'))
    await handlers.handleMessage(makeMsg('100', 'ME3'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rank: 'ME3' }) })
    )
  })
})

describe('/editprofile — edit division', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Division shows division keyboard from DB', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    const keyboard = bot.editMessageText.mock.calls.at(-1)[1].reply_markup.inline_keyboard
    const labels = keyboard.flat().map(b => b.text)
    expect(labels).toContain('2nd Div')
    expect(labels).toContain('SCDF HQ')
    expect(labels).toContain('✏️ Other (type it)')
  })

  test('selecting a known division updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_div:div_2'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ divisionId: 'div_2' }) })
    )
  })

  test('Other → type new division → upserts and links', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division_other'))
    await handlers.handleMessage(makeMsg('100', '5th Division'))
    expect(prisma.division.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: '5th Division' }, create: { name: '5th Division' } })
    )
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ divisionId: 'div_new' }) })
    )
  })
})

describe('/editprofile — edit branch', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Branch shows branch keyboard from DB', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    const keyboard = bot.editMessageText.mock.calls.at(-1)[1].reply_markup.inline_keyboard
    const labels = keyboard.flat().map(b => b.text)
    expect(labels).toContain('Ops')
    expect(labels).toContain('✏️ Other (type it)')
  })

  test('selecting a known branch updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_br:br_1'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 'br_1' }) })
    )
  })

  test('Other → type new branch → upserts and links', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch_other'))
    await handlers.handleMessage(makeMsg('100', 'G3 OPS'))
    expect(prisma.branch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'G3 OPS' }, create: { name: 'G3 OPS' } })
    )
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 'br_new' }) })
    )
  })
})

describe('/editprofile — edit phone', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Phone sends contact keyboard in a separate message', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    const calls = bot.sendMessage.mock.calls
    const contactCall = calls.find(c => c[2]?.reply_markup?.keyboard)
    expect(contactCall).toBeDefined()
    expect(contactCall[2].reply_markup.keyboard[0][0].request_contact).toBe(true)
  })

  test('sharing a new phone updates phoneNumber', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    prisma.officer.findFirst.mockResolvedValue(null) // not taken
    await handlers.handleMessage(makeContactMsg('100', '+6598765432'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phoneNumber: '+6598765432' }) })
    )
  })

  test('phone already linked to another officer is rejected', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    // Different officer has the number
    prisma.officer.findFirst.mockResolvedValue(makeOfficer({ id: 'off_other', telegramId: '999' }))
    await handlers.handleMessage(makeContactMsg('100', '+6598765432'))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenCalledWith(100, expect.stringContaining('linked to another account'))
  })
})

describe('/editprofile — done and cancel', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('Done clears session and confirms', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_done'))
    expect(bot.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('done'),
      expect.objectContaining({ reply_markup: { inline_keyboard: [] } })
    )
  })

  test('Cancel mid name-edit returns to profile card without saving', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_cancel'))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('Your profile'),
      expect.objectContaining({ message_id: msgId })
    )
  })

  test('stale keyboard after Done → expired', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_done'))
    // tap old button on same message
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('expired'),
      expect.objectContaining({ message_id: msgId })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they all fail (feature not yet implemented)**

```bash
cd server && npm test -- --testPathPattern=editprofile
```

Expected: All tests fail with errors like "handleCommand is not a function" or buttons not found in keyboard — that's correct, the handlers don't exist yet.

- [ ] **Step 3: Commit**

```bash
git add server/tests/bot/editprofile.test.js
git commit -m "test: failing tests for /editprofile flow"
```

---

## Task 6: Implement /editprofile — helpers and entry point

**Files:**
- Modify: `server/src/bot/telegram.js`

- [ ] **Step 1: Add `editSessions` Map in the session stores section (around line 16)**

After `const pendingDeletion = new Set()`, add:

```js
const editSessions = new Map()
// keyed by telegramId (string)
// value: { field: 'name'|'rank'|'division'|'branch'|'phone'|null, messageId: number|null, chatId: number }
```

- [ ] **Step 2: Add helper functions in the keyboard builders section**

After the existing `contactKeyboard()` function, add:

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
  const name     = officer.name             || '(not set)'
  const rank     = officer.rank             || '(not set)'
  const division = officer.division?.name   || '(not set)'
  const branch   = officer.branch?.name     || '(not set)'
  const phone    = officer.phoneNumber      || '(not set)'
  return (
    `👤 Your profile:\n\n` +
    `Name: ${name}\nRank: ${rank}\nDivision: ${division}\nBranch: ${branch}\nPhone: ${phone}\n\n` +
    `What would you like to update?`
  )
}

async function divisionKeyboard() {
  const divisions = await prisma.division.findMany({ orderBy: { name: 'asc' } })
  const rows = divisions.map(d => [{ text: d.name, callback_data: `edit_div:${d.id}` }])
  rows.push([{ text: '✏️ Other (type it)', callback_data: 'edit_division_other' }])
  rows.push([{ text: '❌ Cancel',           callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}

async function branchKeyboard() {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } })
  const rows = branches.map(b => [{ text: b.name, callback_data: `edit_br:${b.id}` }])
  rows.push([{ text: '✏️ Other (type it)', callback_data: 'edit_branch_other' }])
  rows.push([{ text: '❌ Cancel',           callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}
```

- [ ] **Step 3: Add `handleEditProfileCommand` function**

Add this function before `handleRosterCommand`:

```js
async function handleEditProfileCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true, branch: true },
  })
  if (!officer) {
    await promptVerification(chatId)
    return
  }

  editSessions.delete(telegramId)

  const sent = await bot.sendMessage(chatId, buildProfileText(officer), {
    reply_markup: editProfileKeyboard(),
  })
  editSessions.set(telegramId, { field: null, messageId: sent.message_id, chatId })
}
```

- [ ] **Step 4: Wire `/editprofile` into `handleCommand`**

In the `handleCommand` function, add before the `/deregister` block:

```js
if (text.startsWith('/editprofile')) {
  await handleEditProfileCommand(msg)
  return
}
```

- [ ] **Step 5: Run the "open profile card" tests**

```bash
cd server && npm test -- --testPathPattern=editprofile -t "open profile card"
```

Expected: All 3 "open profile card" tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/bot/telegram.js
git commit -m "feat: /editprofile command — profile card with edit keyboard"
```

---

## Task 7: Implement edit_name, edit_rank, edit_division, edit_branch callbacks

**Files:**
- Modify: `server/src/bot/telegram.js`

- [ ] **Step 1: Add edit_* callback dispatch at the top of `handleCallbackQuery`**

In `handleCallbackQuery`, add a new block **before** the "Availability callbacks" section (before the `const officer = await prisma.officer.findUnique` call at line ~1158). Add it right after the `week_` prefix block:

```js
// Edit profile callbacks
if (data.startsWith('edit_')) {
  const editSession = editSessions.get(telegramId)

  // edit_done — clear session and confirm
  if (data === 'edit_done') {
    editSessions.delete(telegramId)
    await bot.editMessageText('Profile saved. All done! 👍', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // edit_cancel — return to profile card without saving
  if (data === 'edit_cancel') {
    if (!editSession) {
      await bot.editMessageText('This keyboard has expired.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      })
      return
    }
    const prevField = editSession.field
    editSession.field = null
    if (prevField === 'phone') {
      await bot.sendMessage(chatId, 'Cancelled.', { reply_markup: { remove_keyboard: true } })
    }
    const officer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { division: true, branch: true },
    })
    await bot.editMessageText(buildProfileText(officer), {
      chat_id: chatId, message_id: editSession.messageId,
      reply_markup: editProfileKeyboard(),
    })
    return
  }

  // All other edit_* callbacks require an active session with matching messageId
  if (!editSession || editSession.messageId !== messageId) {
    await bot.editMessageText('This keyboard has expired.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // edit_name — prompt to type new name
  if (data === 'edit_name') {
    editSession.field = 'name'
    await bot.editMessageText("What's your new name? Type it below.", {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] },
    })
    return
  }

  // edit_rank — prompt to type new rank
  if (data === 'edit_rank') {
    editSession.field = 'rank'
    await bot.editMessageText("What's your new rank? Type it below.", {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] },
    })
    return
  }

  // edit_division — show division selection keyboard
  if (data === 'edit_division') {
    editSession.field = 'division'
    await bot.editMessageText('Choose your division:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: await divisionKeyboard(),
    })
    return
  }

  // edit_div:<id> — officer selected a known division
  if (data.startsWith('edit_div:')) {
    const divId = data.slice('edit_div:'.length)
    await prisma.officer.update({ where: { telegramId }, data: { divisionId: divId } })
    editSession.field = null
    const officer = await prisma.officer.findUnique({
      where: { telegramId }, include: { division: true, branch: true },
    })
    await bot.editMessageText(`Updated! Here's your profile:\n\n${buildProfileText(officer)}`, {
      chat_id: chatId, message_id: editSession.messageId,
      reply_markup: editProfileKeyboard(),
    })
    return
  }

  // edit_division_other — prompt to type a new division name
  if (data === 'edit_division_other') {
    editSession.field = 'division'
    await bot.editMessageText('Type your division name:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] },
    })
    return
  }

  // edit_branch — show branch selection keyboard
  if (data === 'edit_branch') {
    editSession.field = 'branch'
    await bot.editMessageText('Choose your branch or type a new one:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: await branchKeyboard(),
    })
    return
  }

  // edit_br:<id> — officer selected a known branch
  if (data.startsWith('edit_br:')) {
    const brId = data.slice('edit_br:'.length)
    await prisma.officer.update({ where: { telegramId }, data: { branchId: brId } })
    editSession.field = null
    const officer = await prisma.officer.findUnique({
      where: { telegramId }, include: { division: true, branch: true },
    })
    await bot.editMessageText(`Updated! Here's your profile:\n\n${buildProfileText(officer)}`, {
      chat_id: chatId, message_id: editSession.messageId,
      reply_markup: editProfileKeyboard(),
    })
    return
  }

  // edit_branch_other — prompt to type a new branch name
  if (data === 'edit_branch_other') {
    editSession.field = 'branch'
    await bot.editMessageText('Type your branch name:', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] },
    })
    return
  }

  // edit_phone — prompt to share phone
  if (data === 'edit_phone') {
    editSession.field = 'phone'
    await bot.editMessageText('Share your new phone number to update it.', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'edit_cancel' }]] },
    })
    await bot.sendMessage(chatId, 'Tap below to share your number:', {
      reply_markup: contactKeyboard(),
    })
    return
  }

  return
}
```

- [ ] **Step 2: Run name, rank, division, branch, done, cancel tests**

```bash
cd server && npm test -- --testPathPattern=editprofile -t "edit name|edit rank|edit division|edit branch|done and cancel"
```

Expected: All matching tests pass except those requiring text input (those need Task 8).

- [ ] **Step 3: Commit**

```bash
git add server/src/bot/telegram.js
git commit -m "feat: edit_* callback handlers for division, branch, done, cancel"
```

---

## Task 8: Implement text input + contact handling for edit session

**Files:**
- Modify: `server/src/bot/telegram.js`

- [ ] **Step 1: Add edit session text-input handling in `handleMessage`**

In `handleMessage`, add a new block **after the contact check** (`if (msg.contact)`) and **before the pending deletion check** (`if (pendingDeletion.has(telegramId))`):

```js
// Edit profile — typed input (name, rank, division, branch)
if (editSessions.has(telegramId) && !msg.contact) {
  const editSession = editSessions.get(telegramId)
  if (editSession.field === 'name' || editSession.field === 'rank' ||
      editSession.field === 'division' || editSession.field === 'branch') {
    const value = rawMessage.trim()

    if (!value) {
      await bot.sendMessage(chatId, "Can't be empty — try again.")
      return
    }

    const maxLen = editSession.field === 'rank' ? 20 : 60
    if (value.length > maxLen) {
      await bot.sendMessage(chatId, `Too long — max ${maxLen} characters.`)
      return
    }

    const field = editSession.field

    if (field === 'division') {
      const division = await prisma.division.upsert({
        where: { name: value },
        create: { name: value },
        update: {},
      })
      await prisma.officer.update({ where: { telegramId }, data: { divisionId: division.id } })
    } else if (field === 'branch') {
      const branch = await prisma.branch.upsert({
        where: { name: value },
        create: { name: value },
        update: {},
      })
      await prisma.officer.update({ where: { telegramId }, data: { branchId: branch.id } })
    } else {
      await prisma.officer.update({ where: { telegramId }, data: { [field]: value } })
    }

    editSession.field = null
    const officer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { division: true, branch: true },
    })
    await bot.editMessageText(`Updated! Here's your profile:\n\n${buildProfileText(officer)}`, {
      chat_id: chatId,
      message_id: editSession.messageId,
      reply_markup: editProfileKeyboard(),
    })
    return
  }
}
```

- [ ] **Step 2: Update `handleContactVerification` to handle phone edit mode**

In `handleContactVerification`, after this existing anti-spoof block:
```js
if (String(contact.user_id) !== telegramId) {
  await bot.sendMessage(chatId, "Please share your own contact, not someone else's.")
  return
}
```

Add the edit session phone handler immediately after:

```js
// Check if this contact share is for an edit_phone flow
const editSession = editSessions.get(telegramId)
if (editSession?.field === 'phone') {
  const phone = normalizePhone(contact.phone_number)

  const existing = await prisma.officer.findFirst({
    where: { phoneNumber: phone },
  })
  const currentOfficer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true, branch: true },
  })

  if (existing && existing.id !== currentOfficer?.id) {
    await bot.sendMessage(chatId, "That number is already linked to another account. No changes made.")
    return
  }

  await prisma.officer.update({ where: { telegramId }, data: { phoneNumber: phone } })
  await bot.sendMessage(chatId, '✅ Phone updated.', { reply_markup: { remove_keyboard: true } })

  editSession.field = null
  const updated = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true, branch: true },
  })
  await bot.editMessageText(`Updated! Here's your profile:\n\n${buildProfileText(updated)}`, {
    chat_id: chatId,
    message_id: editSession.messageId,
    reply_markup: editProfileKeyboard(),
  })
  return
}
```

This block goes right after the anti-spoof check (after `if (String(contact.user_id) !== telegramId) { ... return }`).

- [ ] **Step 3: Run all editprofile tests**

```bash
cd server && npm test -- --testPathPattern=editprofile
```

Expected: All tests pass.

- [ ] **Step 4: Run the full test suite**

```bash
cd server && npm test
```

Expected: All tests pass — no regressions.

- [ ] **Step 5: Commit**

```bash
git add server/src/bot/telegram.js
git commit -m "feat: edit session text input and contact phone update"
```

---

## Done

All tasks complete. The bot now has:

- `setMyCommands()` registered at startup — `/start`, `/roster`, `/editprofile`, `/deregister` in Telegram's command picker
- "View Roster" as a full-width third row on the reply keyboard
- `Division` and `Branch` as proper DB models with FK relations on `Officer`
- 6 seeded SCDF divisions: 1st Div, 2nd Div, 3rd Div, 4th Div, Marine Division, SCDF HQ
- `/editprofile` command — sequential field-edit flow for name, rank, division, branch, and phone number; division and branch shown as selection keyboards with "Other (type it)" escape hatch that auto-creates new records
