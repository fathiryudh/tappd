# Holiday / Leave Range Feature — Design Spec

**Date:** 2026-04-19

---

## Overview

Officers going on multi-day leave (holiday, block VL, extended MC, etc.) currently have to report each day individually or use multi-day syntax like `mon ovl, tue ovl, wed ovl`. This feature adds a date-range shortcut so an officer can mark an entire leave block in one message or command.

---

## Scope

- Text shortcut: `<reason> <start> to <end>` — supports any leave reason
- `/holiday` command: guided 3-step flow, hardcoded to OVL
- Weekends (Sat/Sun) are skipped automatically — only weekdays are written
- Existing records within the range are overwritten
- Max range: 60 weekdays; bot rejects anything larger with a clear error message
- README updated with officer-facing documentation

---

## Text Shortcut

### Parser extension (`server/src/bot/parser.js`)

New exported function: `dateRangeMatch(raw, todayISO)`

**Detection pattern:** `<reason> <date> to <date>` or `<date> to <date> <reason>`

**Supported date formats** (same as existing multi-day parser):
- `21/4`, `21/04`, `21/4/2026`
- `21 apr`, `21 april`

**Logic:**
1. Attempt to match the pattern with a regex scan
2. Parse start and end date strings using the existing date parsing helpers
3. Validate: end >= start, range <= 60 weekdays
4. Enumerate every Mon–Fri date in the range inclusive
5. Look up the reason token using the existing `parseStatusToken`
6. Return an array of `{ date, status: 'OUT', reason, notes: '' }` records

**Returns:** array of records (same shape as `keywordMatch`) or `null` if no match.

**Examples:**
```
ovl 21/4 to 30/4         → OUT (OVL) for 8 weekdays: 22,23,24,25,28,29,30 Apr, 1 May... wait
ovl 21/4 to 30/4         → weekdays from Mon 21 Apr to Wed 30 Apr inclusive
vl 5 may to 9 may        → OUT (VL) Mon–Fri that week
mc 21/4 to 25/4          → OUT (MC) Mon–Fri 21–25 Apr
wfh 28/4 to 2/5          → OUT (WFH) Mon–Fri across two weeks
```

### Integration in `telegram.js`

`dateRangeMatch` is called in the message handler after `keywordMatch` and before `multiDayMatch`. On a valid match the records go straight to `storeAndConfirm` — no extra state needed.

---

## `/holiday` Command (Guided Flow)

### Bot state

New in-memory Map: `holidaySessions`

```js
// telegramId → { step: 'start' | 'end', startDate: string }
```

### Command registration

`/holiday` added to `setMyCommands` list:
```
{ command: 'holiday', description: 'Mark yourself OVL for a date range' }
```

### Flow

| Step | Bot says | Officer does |
|---|---|---|
| 1 | "What is your start date? (e.g. 21/4 or 21 Apr)" | Types a date |
| 2 | "What is your end date?" | Types a date |
| 3 | "This will mark you OUT (OVL) for N weekdays from DD Mon – DD Mon. Confirm?" [Yes] [Cancel] | Taps Yes or Cancel |
| Done | Multi-record confirmation summary | — |

### Validation

- Unrecognised date → bot replies "Couldn't read that date — try 21/4 or 21 Apr" and stays on the same step
- End date before start date → bot replies "End date must be after start date" and re-asks for end date
- Range > 60 weekdays → bot replies "That's over 60 working days — please check your dates" and re-asks
- Cancel at any step → clears `holidaySessions`, bot confirms cancellation

### Session cleanup

Session is deleted on: confirm, cancel, `/start`, or any other command that resets state (consistent with how `editSessions` is cleared).

---

## Shared logic

A helper `expandWeekdays(startISO, endISO)` is added to `parser.js` (or `date.js`). It returns all Mon–Fri ISO date strings between two dates inclusive, capped at 60. Both the text shortcut and the `/holiday` flow use this helper.

---

## README Changes

1. New section **"Planning a Holiday or Leave Block"** added after "Multi-Day Reporting":
   - Explains `/holiday` command step by step in plain language
   - Shows text shortcut examples for different leave types
   - Notes that weekends are skipped and existing records are overwritten

2. **Quick Reference** section updated:
   - `/holiday` added to Bot Commands table
   - Range syntax added to Keyword Cheat Sheet

---

## Out of Scope

- Cancelling / clearing a booked leave range (use `/report` to overwrite individual days)
- Dashboard UI changes (ranges show as normal OUT records in the grid)
- Notifications per day in the range are created as normal (one per record saved)
