# Holiday / Leave Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let officers mark a block of weekdays as OUT with a single text shortcut (`ovl 21/4 to 30/4`) or via a guided `/holiday` command (hardcoded to OVL).

**Architecture:** Two new parser functions (`parseSingleDate`, `expandWeekdays`) power both the text shortcut (`dateRangeMatch`) and the `/holiday` guided flow. `dateRangeMatch` is called in `handleMessage` before `keywordMatch` so range inputs aren't swallowed by the single-day keyword matcher. The `/holiday` flow uses a new `holidaySessions` Map following the same in-memory session pattern as `editSessions`.

**Tech Stack:** Node.js, node-telegram-bot-api, Prisma, Jest

---

## File Map

| File | Change |
|---|---|
| `server/src/bot/parser.js` | Add `parseSingleDate`, `expandWeekdays`, `dateRangeMatch`; update exports |
| `server/src/bot/telegram.js` | Add `holidaySessions` Map; wire `dateRangeMatch` into `handleMessage`; add `/holiday` command in `handleCommand`; add holiday session handler; add `holiday:confirm`/`holiday:cancel` callbacks; update `setMyCommands` |
| `server/tests/bot/holiday.test.js` | New test file — parser unit tests + bot integration tests |
| `README.md` | New "Planning a Holiday" section + Quick Reference updates |

---

## Task 1: Parser helpers — `parseSingleDate` and `expandWeekdays`

**Files:**
- Modify: `server/src/bot/parser.js`
- Create: `server/tests/bot/holiday.test.js`

- [ ] **Step 1: Create the test file with failing tests for `parseSingleDate`**

```js
// server/tests/bot/holiday.test.js
'use strict'

const { parseSingleDate, expandWeekdays, dateRangeMatch } = require('../../src/bot/parser')

const TODAY = '2026-04-21' // a Monday

describe('parseSingleDate', () => {
  test('slash format 21/4', () => {
    expect(parseSingleDate('21/4', TODAY)).toBe('2026-04-21')
  })

  test('slash format 21/04', () => {
    expect(parseSingleDate('21/04', TODAY)).toBe('2026-04-21')
  })

  test('slash format with year 21/4/2026', () => {
    expect(parseSingleDate('21/4/2026', TODAY)).toBe('2026-04-21')
  })

  test('named month "21 apr"', () => {
    expect(parseSingleDate('21 apr', TODAY)).toBe('2026-04-21')
  })

  test('named month "21 april"', () => {
    expect(parseSingleDate('21 april', TODAY)).toBe('2026-04-21')
  })

  test('named month "5 may"', () => {
    expect(parseSingleDate('5 may', TODAY)).toBe('2026-05-05')
  })

  test('case insensitive', () => {
    expect(parseSingleDate('21 APR', TODAY)).toBe('2026-04-21')
  })

  test('invalid string returns null', () => {
    expect(parseSingleDate('notadate', TODAY)).toBeNull()
  })

  test('empty string returns null', () => {
    expect(parseSingleDate('', TODAY)).toBeNull()
  })
})

describe('expandWeekdays', () => {
  test('Mon–Fri single week returns 5 days', () => {
    const days = expandWeekdays('2026-04-21', '2026-04-25')
    expect(days).toEqual([
      '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25',
    ])
  })

  test('skips Saturday and Sunday', () => {
    const days = expandWeekdays('2026-04-24', '2026-04-27')
    expect(days).toEqual(['2026-04-24', '2026-04-27'])
  })

  test('end before start returns empty array', () => {
    expect(expandWeekdays('2026-04-25', '2026-04-21')).toEqual([])
  })

  test('same day (weekday) returns one entry', () => {
    expect(expandWeekdays('2026-04-21', '2026-04-21')).toEqual(['2026-04-21'])
  })

  test('same day (weekend) returns empty array', () => {
    expect(expandWeekdays('2026-04-25', '2026-04-25')).toEqual([])
  })

  test('caps at 61 entries for very long ranges', () => {
    // 300 calendar days will have >60 weekdays
    const days = expandWeekdays('2026-01-01', '2026-12-31')
    expect(days.length).toBeGreaterThan(60)
    // caller checks length > 60 to detect overflow — we just need it to stop iterating
    expect(days.length).toBeLessThanOrEqual(61)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail (functions not exported yet)**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -20
```

Expected: `TypeError: parseSingleDate is not a function` or similar.

- [ ] **Step 3: Add `parseSingleDate` and `expandWeekdays` to `parser.js`**

Add these two functions to `server/src/bot/parser.js`, before the `module.exports` line:

```js
// --- Date range helpers ---

/**
 * Parse a single date string (slash or named-month format) into an ISO date.
 * Returns null if unrecognised.
 * @param {string} str
 * @param {string} todayISO
 * @returns {string|null}
 */
function parseSingleDate(str, todayISO) {
  const s = str.trim().toLowerCase()
  if (!s) return null

  // Slash format: 21/4, 21/04, 21/4/2026
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10)
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date(todayISO + 'T00:00:00').getFullYear()
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Named month format: "21 apr", "21 april", "21 apr 2026"
  const tokens = s.split(/\s+/)
  if (tokens.length >= 2) {
    const dayNum = parseInt(tokens[0], 10)
    if (!isNaN(dayNum) && String(dayNum) === tokens[0]) {
      const monthNum = MONTH_MAP[tokens[1]]
      if (monthNum) {
        let year = new Date(todayISO + 'T00:00:00').getFullYear()
        if (tokens[2]) {
          const possibleYear = parseInt(tokens[2], 10)
          if (!isNaN(possibleYear) && possibleYear > 2020) year = possibleYear
        }
        if (dayNum < 1 || dayNum > 31) return null
        return `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      }
    }
  }

  return null
}

/**
 * Return all Mon–Fri ISO dates between startISO and endISO inclusive.
 * Stops collecting after 61 entries so callers can detect overflow (length > 60).
 * Returns [] if end < start.
 * @param {string} startISO
 * @param {string} endISO
 * @returns {string[]}
 */
function expandWeekdays(startISO, endISO) {
  const result = []
  const current = new Date(startISO + 'T00:00:00')
  const end = new Date(endISO + 'T00:00:00')
  while (current <= end) {
    const dow = current.getDay()
    if (dow >= 1 && dow <= 5) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      result.push(`${y}-${m}-${d}`)
      if (result.length > 60) return result // signal overflow to caller
    }
    current.setDate(current.getDate() + 1)
  }
  return result
}
```

Update the `module.exports` line at the bottom of `parser.js`:

```js
module.exports = { expandRecords, keywordMatch, multiDayMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput, parseSingleDate, expandWeekdays }
```

- [ ] **Step 4: Run tests — confirm `parseSingleDate` and `expandWeekdays` pass**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -30
```

Expected: all `parseSingleDate` and `expandWeekdays` tests pass. `dateRangeMatch` tests still fail (not implemented yet).

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/holiday-range
git add server/src/bot/parser.js server/tests/bot/holiday.test.js
git commit -m "Add parseSingleDate and expandWeekdays helpers to parser"
```

---

## Task 2: `dateRangeMatch` parser function

**Files:**
- Modify: `server/src/bot/parser.js`
- Modify: `server/tests/bot/holiday.test.js`

- [ ] **Step 1: Add failing tests for `dateRangeMatch` to `holiday.test.js`**

Append this block to `server/tests/bot/holiday.test.js`:

```js
describe('dateRangeMatch', () => {
  test('ovl 21/4 to 30/4 → OUT(OVL) for all weekdays', () => {
    const records = dateRangeMatch('ovl 21/4 to 30/4', TODAY)
    expect(records).not.toBeNull()
    // 21 Apr (Mon) to 30 Apr (Thu) = 21,22,23,24,27,28,29,30 → 8 weekdays
    expect(records).toHaveLength(8)
    expect(records[0]).toEqual({ date: '2026-04-21', status: 'OUT', reason: 'OVL', notes: '' })
    expect(records.every(r => r.status === 'OUT' && r.reason === 'OVL')).toBe(true)
  })

  test('vl 5 may to 9 may → OUT(VL) Mon–Fri that week', () => {
    const records = dateRangeMatch('vl 5 may to 9 may', TODAY)
    expect(records).not.toBeNull()
    expect(records).toHaveLength(5)
    expect(records[0]).toEqual({ date: '2026-05-05', status: 'OUT', reason: 'VL', notes: '' })
    expect(records[4]).toEqual({ date: '2026-05-09', status: 'OUT', reason: 'VL', notes: '' })
  })

  test('mc 21/4 to 25/4 → OUT(MC) five days', () => {
    const records = dateRangeMatch('mc 21/4 to 25/4', TODAY)
    expect(records).not.toBeNull()
    expect(records).toHaveLength(5)
    expect(records.every(r => r.reason === 'MC')).toBe(true)
  })

  test('wfh 28/4 to 2/5 → spans month boundary correctly', () => {
    const records = dateRangeMatch('wfh 28/4 to 2/5', TODAY)
    expect(records).not.toBeNull()
    // 28 Apr (Tue), 29 Apr (Wed), 30 Apr (Thu), 1 May (Fri), 2 May (Sat-skipped) → wait
    // 2/5 is a Saturday, so: 28,29,30 Apr + no weekend = 3 weekdays? Let me check:
    // 28 Apr 2026 = Tue, 29 = Wed, 30 = Thu, 1 May = Fri, 2 May = Sat (skipped)
    // Result: 4 weekdays
    expect(records).toHaveLength(4)
    expect(records[3]).toEqual({ date: '2026-05-01', status: 'OUT', reason: 'WFH', notes: '' })
  })

  test('case insensitive: OVL 21/4 to 30/4', () => {
    const records = dateRangeMatch('OVL 21/4 to 30/4', TODAY)
    expect(records).not.toBeNull()
    expect(records).toHaveLength(8)
  })

  test('end before start → returns null', () => {
    expect(dateRangeMatch('ovl 30/4 to 21/4', TODAY)).toBeNull()
  })

  test('unknown reason → returns null', () => {
    expect(dateRangeMatch('holiday 21/4 to 30/4', TODAY)).toBeNull()
  })

  test('no "to" keyword → returns null', () => {
    expect(dateRangeMatch('ovl 21/4', TODAY)).toBeNull()
  })

  test('range > 60 weekdays → returns null', () => {
    // ~90 weekdays in a calendar quarter
    expect(dateRangeMatch('ovl 1/1 to 30/6', TODAY)).toBeNull()
  })

  test('plain "ovl" (today only, no range) → returns null', () => {
    expect(dateRangeMatch('ovl', TODAY)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — confirm `dateRangeMatch` tests fail**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -20
```

Expected: `TypeError: dateRangeMatch is not a function`.

- [ ] **Step 3: Implement `dateRangeMatch` in `parser.js`**

Add this function to `server/src/bot/parser.js`, immediately after `expandWeekdays`:

```js
/**
 * Match free-text range input: "<reason> <startDate> to <endDate>"
 * Returns an array of OUT records for each weekday in the range, or null if no match.
 * @param {string} raw
 * @param {string} todayISO
 * @returns {Array<{date:string,status:string,reason:string,notes:string}>|null}
 */
function dateRangeMatch(raw, todayISO) {
  const lower = raw.toLowerCase().trim()

  const toIdx = lower.indexOf(' to ')
  if (toIdx === -1) return null

  const left = lower.slice(0, toIdx).trim()   // e.g. "ovl 21/4"
  const right = lower.slice(toIdx + 4).trim() // e.g. "30/4"

  // Left must be: <reason_token> <date_string>
  const leftTokens = left.split(/\s+/)
  if (leftTokens.length < 2) return null

  const statusInfo = parseStatusToken(leftTokens[0])
  if (!statusInfo) return null

  const startISO = parseSingleDate(leftTokens.slice(1).join(' '), todayISO)
  if (!startISO) return null

  const endISO = parseSingleDate(right, todayISO)
  if (!endISO) return null

  if (endISO < startISO) return null

  const days = expandWeekdays(startISO, endISO)
  if (days.length === 0 || days.length > 60) return null

  return days.map(date => ({ date, status: statusInfo.status, reason: statusInfo.reason, notes: '' }))
}
```

Update `module.exports`:

```js
module.exports = { expandRecords, keywordMatch, multiDayMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput, parseSingleDate, expandWeekdays, dateRangeMatch }
```

- [ ] **Step 4: Run all tests — confirm everything passes**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -30
```

Expected: all tests in `holiday.test.js` pass.

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
cd server && npm test --no-coverage 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/bot/parser.js server/tests/bot/holiday.test.js
git commit -m "Add dateRangeMatch parser function for leave range shortcuts"
```

---

## Task 3: Wire `dateRangeMatch` into `handleMessage`

**Files:**
- Modify: `server/src/bot/telegram.js`
- Modify: `server/tests/bot/holiday.test.js`

- [ ] **Step 1: Add integration tests for the text shortcut flow**

Append this block to `server/tests/bot/holiday.test.js`:

```js
const { makeMsg, setupMocks } = require('./helpers')

const USER_ID = 200

beforeAll(() => jest.useFakeTimers({ now: new Date('2026-04-21T08:00:00') })) // Monday
afterAll(() => jest.useRealTimers())

describe('dateRangeMatch integration via handleMessage', () => {
  let bot, prisma, handleMessage

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage } } = setupMocks())
  })

  test('"ovl 21/4 to 25/4" saves 5 OUT(OVL) records', async () => {
    await handleMessage(makeMsg(USER_ID, 'ovl 21/4 to 25/4'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(5)
    const calls = prisma.availability.upsert.mock.calls
    expect(calls[0][0].create).toMatchObject({ status: 'OUT', reason: 'OVL' })
    expect(calls[4][0].create).toMatchObject({ status: 'OUT', reason: 'OVL' })
  })

  test('"vl 21/4 to 25/4" saves 5 OUT(VL) records', async () => {
    await handleMessage(makeMsg(USER_ID, 'vl 21/4 to 25/4'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(5)
    expect(prisma.availability.upsert.mock.calls[0][0].create).toMatchObject({ status: 'OUT', reason: 'VL' })
  })

  test('plain "ovl" (no range) still saves single record for today', async () => {
    await handleMessage(makeMsg(USER_ID, 'ovl'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
  })

  test('range > 60 weekdays falls through to keyboard (no upsert)', async () => {
    await handleMessage(makeMsg(USER_ID, 'ovl 1/1 to 30/6'))

    // dateRangeMatch returns null for >60 weekdays, so falls through to session/keyboard
    expect(prisma.availability.upsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — confirm integration tests fail**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -20
```

Expected: `handleMessage` integration tests fail (dateRangeMatch not wired yet).

- [ ] **Step 3: Update imports in `telegram.js` and wire `dateRangeMatch` into `handleMessage`**

At the top of `server/src/bot/telegram.js`, update the parser import line (line 3):

```js
const { expandRecords, keywordMatch, multiDayMatch, dateRangeMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput, parseSingleDate, expandWeekdays } = require('./parser')
```

In `handleMessage`, find the block that calls `multiDayMatch` (around line 1202):

```js
  const multiRecords = multiDayMatch(rawMessage, todayISO)
  if (multiRecords && multiRecords.length >= 2) {
```

Insert `dateRangeMatch` immediately **before** that block:

```js
  const rangeRecords = dateRangeMatch(rawMessage, todayISO)
  if (rangeRecords) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    await storeAndConfirm(rangeRecords, officer, chatId, rawMessage, null)
    return
  }

  const multiRecords = multiDayMatch(rawMessage, todayISO)
```

- [ ] **Step 4: Run integration tests — confirm they pass**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
cd server && npm test --no-coverage 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add server/src/bot/telegram.js server/tests/bot/holiday.test.js
git commit -m "Wire dateRangeMatch into handleMessage before keywordMatch"
```

---

## Task 4: `/holiday` command and guided session flow

**Files:**
- Modify: `server/src/bot/telegram.js`
- Modify: `server/tests/bot/holiday.test.js`

- [ ] **Step 1: Add failing tests for the `/holiday` flow**

Append to `server/tests/bot/holiday.test.js`:

```js
describe('/holiday guided flow', () => {
  let bot, prisma, handleMessage, handleCommand

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCommand } } = setupMocks())
  })

  test('/holiday prompts for start date', async () => {
    await handleCommand(makeMsg(USER_ID, '/holiday'))

    expect(bot.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('start date'),
      expect.any(Object)
    )
  })

  test('/holiday → start date → prompts for end date', async () => {
    await handleCommand(makeMsg(USER_ID, '/holiday'))
    await handleMessage(makeMsg(USER_ID, '21/4'))

    expect(bot.sendMessage).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.stringContaining('end date'),
      expect.any(Object)
    )
  })

  test('/holiday → start → end → shows confirmation with count', async () => {
    await handleCommand(makeMsg(USER_ID, '/holiday'))
    await handleMessage(makeMsg(USER_ID, '21/4'))
    await handleMessage(makeMsg(USER_ID, '25/4'))

    const lastCall = bot.sendMessage.mock.calls[bot.sendMessage.mock.calls.length - 1]
    expect(lastCall[1]).toContain('5 working day')
    expect(lastCall[1]).toContain('OVL')
    expect(lastCall[2].reply_markup.inline_keyboard[0]).toHaveLength(2) // Yes + Cancel
  })

  test('invalid start date re-prompts', async () => {
    await handleCommand(makeMsg(USER_ID, '/holiday'))
    await handleMessage(makeMsg(USER_ID, 'notadate'))

    expect(bot.sendMessage).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.stringContaining("Couldn't read"),
      expect.anything()
    )
  })

  test('end date before start date re-prompts', async () => {
    await handleCommand(makeMsg(USER_ID, '/holiday'))
    await handleMessage(makeMsg(USER_ID, '25/4'))
    await handleMessage(makeMsg(USER_ID, '21/4'))

    expect(bot.sendMessage).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.stringContaining('after start'),
      expect.anything()
    )
  })

  test('NSF cannot use /holiday', async () => {
    ;({ bot, prisma, handlers: { handleCommand } } = setupMocks({ role: 'NSF' }))
    await handleCommand(makeMsg(USER_ID, '/holiday'))

    expect(bot.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('NSF'),
      expect.anything()
    )
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Add `holidaySessions` Map and helper to `telegram.js`**

Find where the existing session Maps are declared (around line 94):

```js
const sessions = new Map()
```

Add `holidaySessions` immediately after the existing Map declarations:

```js
const holidaySessions = new Map()  // telegramId → { step: 'start'|'end'|'confirm', startDate, endDate, days, chatId }
```

Add this helper function near the other `fmt` helpers (e.g. near line 700):

```js
function fmtDateShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
}
```

- [ ] **Step 4: Add `handleHolidaySession` function to `telegram.js`**

Add this function before `handleMessage`:

```js
async function handleHolidaySession(telegramId, chatId, rawMessage, todayISO) {
  const session = holidaySessions.get(telegramId)
  if (!session) return false

  // Any slash command cancels the holiday flow
  if (rawMessage.startsWith('/')) {
    holidaySessions.delete(telegramId)
    return false // let the command handler process it
  }

  if (session.step === 'start') {
    const startISO = parseSingleDate(rawMessage, todayISO)
    if (!startISO) {
      await bot.sendMessage(chatId, "Couldn't read that date — try 21/4 or 21 Apr")
      return true
    }
    session.startDate = startISO
    session.step = 'end'
    await bot.sendMessage(chatId, "What is your end date? (e.g. 30/4 or 30 Apr)", {
      reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'holiday:cancel' }]] },
    })
    return true
  }

  if (session.step === 'end') {
    const endISO = parseSingleDate(rawMessage, todayISO)
    if (!endISO) {
      await bot.sendMessage(chatId, "Couldn't read that date — try 30/4 or 30 Apr")
      return true
    }
    if (endISO < session.startDate) {
      await bot.sendMessage(chatId, "End date must be after start date. What is your end date?")
      return true
    }
    const days = expandWeekdays(session.startDate, endISO)
    if (days.length === 0) {
      await bot.sendMessage(chatId, "No working days in that range. Please try different dates.")
      return true
    }
    if (days.length > 60) {
      await bot.sendMessage(chatId, "That's over 60 working days — please check your dates. What is your end date?")
      return true
    }
    session.endDate = endISO
    session.days = days
    session.step = 'confirm'
    const n = days.length
    const startFmt = fmtDateShort(session.startDate)
    const endFmt = fmtDateShort(endISO)
    await bot.sendMessage(
      chatId,
      `This will mark you OUT (OVL) for ${n} working day${n !== 1 ? 's' : ''} from ${startFmt} – ${endFmt}. Confirm?`,
      {
        reply_markup: { inline_keyboard: [[
          { text: 'Yes, confirm', callback_data: 'holiday:confirm' },
          { text: 'Cancel', callback_data: 'holiday:cancel' },
        ]] },
      }
    )
    return true
  }

  return true
}
```

- [ ] **Step 5: Add `/holiday` command handler inside `handleCommand`**

Inside `handleCommand`, just before the closing brace (after `/deregister`), add:

```js
  if (text.startsWith('/holiday')) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) {
      await bot.sendMessage(msg.chat.id, "Not registered. Send /start to get started.")
      return
    }
    if (officer.role === 'NSF') {
      await bot.sendMessage(msg.chat.id, 'NSFs cannot log attendance. Use /roster to view the roster.')
      return
    }
    holidaySessions.set(telegramId, { step: 'start', startDate: null, endDate: null, days: null, chatId: msg.chat.id })
    await bot.sendMessage(msg.chat.id,
      "What is your start date? (e.g. 21/4 or 21 Apr)",
      { reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'holiday:cancel' }]] } }
    )
    return
  }
```

- [ ] **Step 6: Call `handleHolidaySession` inside `handleMessage`**

In `handleMessage`, find the block that checks `editSessions` (around line 1131). Add the holiday session check **after** the `editSessions` block and **before** the `pendingDeletion` block:

```js
  // Holiday guided flow
  if (holidaySessions.has(telegramId)) {
    const handled = await handleHolidaySession(telegramId, chatId, rawMessage, todayISO)
    if (handled) return
    // If not handled (slash command), fall through to handleCommand routing
  }
```

Also clear `holidaySessions` wherever other sessions are cleared on `/start`. In the `handleCommand` function, inside the `text.startsWith('/start')` block, add:

```js
    holidaySessions.delete(telegramId)
```

right after any existing session cleanup (e.g. after line that clears `editSessions` if present, or just before the `bot.sendMessage` for `/start`).

- [ ] **Step 7: Run holiday flow tests**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -40
```

Expected: all `/holiday` guided flow tests pass.

- [ ] **Step 8: Run full suite**

```bash
cd server && npm test --no-coverage 2>&1 | tail -20
```

- [ ] **Step 9: Commit**

```bash
git add server/src/bot/telegram.js server/tests/bot/holiday.test.js
git commit -m "Add /holiday guided flow for OVL date range booking"
```

---

## Task 5: `holiday:confirm` and `holiday:cancel` callbacks

**Files:**
- Modify: `server/src/bot/telegram.js`
- Modify: `server/tests/bot/holiday.test.js`

- [ ] **Step 1: Add failing tests for confirm/cancel callbacks**

Append to `server/tests/bot/holiday.test.js`:

```js
describe('/holiday confirm and cancel callbacks', () => {
  let bot, prisma, handleMessage, handleCommand, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCommand, handleCallbackQuery } } = setupMocks())
  })

  test('holiday:confirm saves all OVL records', async () => {
    const { makeCallback } = require('./helpers')
    // Drive the session to confirm step
    await handleCommand(makeMsg(USER_ID, '/holiday'))
    await handleMessage(makeMsg(USER_ID, '21/4'))
    await handleMessage(makeMsg(USER_ID, '25/4'))

    prisma.availability.upsert.mockClear()

    await handleCallbackQuery(makeCallback(USER_ID, 1, 'holiday:confirm'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(5)
    expect(prisma.availability.upsert.mock.calls[0][0].create).toMatchObject({
      status: 'OUT',
      reason: 'OVL',
    })
  })

  test('holiday:cancel clears session and confirms to user', async () => {
    const { makeCallback } = require('./helpers')
    await handleCommand(makeMsg(USER_ID, '/holiday'))

    await handleCallbackQuery(makeCallback(USER_ID, 1, 'holiday:cancel'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.stringContaining('cancel'),
      expect.any(Object)
    )
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Add `holiday:confirm` and `holiday:cancel` to `handleCallbackQuery`**

In `server/src/bot/telegram.js`, find `handleCallbackQuery`. Near the top where `data` is parsed, find where other callback prefixes are handled (e.g. `cancel`, `status:`, etc.). Add a holiday block early in the function:

```js
  if (data === 'holiday:cancel') {
    holidaySessions.delete(telegramId)
    await bot.answerCallbackQuery(query.id)
    await bot.sendMessage(chatId, "Holiday planning cancelled.", { reply_markup: replyKeyboardMarkup() })
    return
  }

  if (data === 'holiday:confirm') {
    const session = holidaySessions.get(telegramId)
    if (!session || session.step !== 'confirm' || !session.days) {
      await bot.answerCallbackQuery(query.id)
      return
    }
    holidaySessions.delete(telegramId)
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await bot.answerCallbackQuery(query.id); return }
    const records = session.days.map(date => ({ date, status: 'OUT', reason: 'OVL', notes: '' }))
    await bot.answerCallbackQuery(query.id)
    await storeAndConfirm(records, officer, chatId, 'holiday_confirm', null)
    return
  }
```

- [ ] **Step 4: Find where `handleCallbackQuery` gets `telegramId` and `chatId`**

Check that `telegramId` and `chatId` are derived early in `handleCallbackQuery` (they should already be from the existing code). Confirm by looking at the top of the function:

```bash
grep -n "telegramId\|chatId" /Users/fathir/Documents/yappd/server/src/bot/telegram.js | grep -A2 -B2 "handleCallbackQuery"
```

- [ ] **Step 5: Run callback tests**

```bash
cd server && npm test -- --testPathPattern=holiday --no-coverage 2>&1 | tail -40
```

Expected: all callback tests pass.

- [ ] **Step 6: Run full suite**

```bash
cd server && npm test --no-coverage 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add server/src/bot/telegram.js server/tests/bot/holiday.test.js
git commit -m "Add holiday:confirm and holiday:cancel callback handlers"
```

---

## Task 6: Register `/holiday` in `setMyCommands`

**Files:**
- Modify: `server/src/bot/telegram.js`

- [ ] **Step 1: Add `/holiday` to the `setMyCommands` call**

Find the `setMyCommands` block (around line 10):

```js
    bot.setMyCommands([
      { command: 'start',       description: 'Register or view your profile' },
      { command: 'roster',      description: "View today's attendance roster" },
      { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
      { command: 'deregister',  description: 'Remove your profile and attendance history' },
    ])
```

Replace with:

```js
    bot.setMyCommands([
      { command: 'start',       description: 'Register or view your profile' },
      { command: 'report',      description: 'Log attendance for today' },
      { command: 'status',      description: "Check today's attendance status" },
      { command: 'holiday',     description: 'Mark yourself OVL for a date range' },
      { command: 'roster',      description: "View today's attendance roster" },
      { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
      { command: 'deregister',  description: 'Remove your profile and attendance history' },
    ])
```

- [ ] **Step 2: Run full test suite**

```bash
cd server && npm test --no-coverage 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add server/src/bot/telegram.js
git commit -m "Add /holiday and /report to bot command menu"
```

---

## Task 7: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add "Planning a Holiday or Leave Block" section**

Open `README.md`. Find the "Multi-Day Reporting" section (around line 151) and insert the following new section **after** it (before "Planning Your Week"):

```markdown
### Planning a Holiday or Leave Block

If you are going away for several days, you can mark your entire leave period in one go instead of reporting day by day.

**Using the `/holiday` command:**

Type `/holiday` to start. The bot will guide you through three steps:

1. The bot asks for your **start date** — type it in, for example `21/4` or `21 Apr`.
2. The bot asks for your **end date** — type it the same way.
3. The bot shows a summary of how many working days will be marked and asks you to confirm.

Tap **Yes, confirm** to save, or **Cancel** to stop.

All weekends in the range are skipped automatically — only Monday to Friday are recorded. Any status you have already set for days within that range will be overwritten.

> Example: typing `/holiday` and entering `21/4` then `30/4` will mark you OUT (OVL) for every working day from 21 Apr to 30 Apr.

---

**Using the text shortcut:**

You can also type a range directly without going through the guided steps. The format is:

```
<leave type> <start date> to <end date>
```

Examples:

| What you type | What is saved |
|---|---|
| `ovl 21/4 to 30/4` | OUT (OVL) for all working days 21–30 Apr |
| `vl 5 may to 9 may` | OUT (VL) Mon–Fri that week |
| `mc 21/4 to 25/4` | OUT (MC) Mon–Fri 21–25 Apr |
| `wfh 28/4 to 2/5` | OUT (WFH) for working days across the two weeks |

The leave type must be one of the standard keywords: `ovl`, `vl`, `mc`, `oil`, `wfh`, `course`, `hq`.

Weekends are skipped. Existing records in the range are overwritten.

> Ranges longer than 60 working days are not accepted — contact your admin if you need to book more than that.

---
```

- [ ] **Step 2: Update Quick Reference — Bot Commands table**

Find the Bot Commands table in the Quick Reference section and add `/holiday`:

```markdown
| `/holiday` | Mark yourself OVL for a date range |
```

- [ ] **Step 3: Update Quick Reference — Keyword Cheat Sheet**

Add the range syntax to the cheat sheet block:

```
Range:  ovl 21/4 to 30/4              →  OUT (OVL) for all weekdays in range
        vl 5 may to 9 may             →  OUT (VL) for all weekdays in range
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document holiday range feature in README for officers"
```

---

## Task 8: Merge and deploy

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin feat/holiday-range
```

- [ ] **Step 2: Merge to main**

```bash
git checkout main
git merge feat/holiday-range
git push origin main
```

Render will auto-deploy from `main`.
