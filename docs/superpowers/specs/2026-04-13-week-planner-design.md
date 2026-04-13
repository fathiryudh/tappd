# Week Planner & Reply Keyboard — Design Spec
**Date:** 2026-04-13  
**Project:** Yappd — SCDF 2nd Division HQ Telegram Bot  
**Status:** Approved

---

## Problem

Officers currently need to type a message to start any bot interaction. The single-day keyboard flow (Status → Reason → Date) requires 3+ taps and the date buttons don't show enough context. Each officer has a different weekly schedule, and split days are common in SCDF.

---

## Solution Overview

Two additions to `server/src/bot/telegram.js`:

1. **Reply Keyboard** — persistent bottom buttons, always visible, no typing needed
2. **Week Grid** — interactive 5-day planner inside one Telegram message, edits in-place

---

## 1. Reply Keyboard (ReplyKeyboardMarkup)

A persistent keyboard shown at the bottom of every officer's chat. Set using `ReplyKeyboardMarkup` (not inline).

### Buttons
```
[📋 Report Today]   [📅 Plan This Week]
[📅 Plan Next Week] [📊 My Status]
```

### When to show
- After self-registration completes
- After any successful `storeAndConfirm` call
- On `/start` command
- On `/report` command

### Button behaviour
| Button | Action |
|---|---|
| 📋 Report Today | Opens existing single-day STATUS inline keyboard |
| 📅 Plan This Week | Opens Week Grid for Mon–Fri of current week |
| 📅 Plan Next Week | Opens Week Grid for Mon–Fri of next week |
| 📊 My Status | Shows today's logged status inline (same as /status) |

### Implementation note
Sent via `reply_markup: { keyboard: [...], resize_keyboard: true, persistent: true }` on any `sendMessage` call. Does not interfere with inline keyboards on other messages.

---

## 2. Week Grid

A single Telegram message that shows all 5 working days. Officer fills days in any order. The message edits in-place — no new messages, no chat spam.

### Initial state
```
📅 Week of 14–18 Apr 2026
Tap a day to set your status.

[Mon 14 —][Tue 15 —][Wed 16 —]
[Thu 17 —][Fri 18 —]

[✅ All IN this week][❌ Cancel]
```

### After some days are filled
```
📅 Week of 14–18 Apr 2026

[Mon 14 ✅][Tue 15 ✅][Wed 16 ✅]
[Thu 17 ❌VL][Fri 18 —]

[✅ Confirm (4 set)][✅ All IN remaining][❌ Cancel]
```

### Day picker (replaces grid message)
```
Thu 17 Apr — what's your status?
[✅ In][❌ Out...][↔️ Split]
[← Back to week]
```

### Split day sub-flow (within the grid session)
```
Thu 17 Apr — morning status?
[✅ In (AM)][❌ Out (AM)]
[← Back]
```
Then afternoon. If either half is OUT → reason keyboard → back to grid.

### Day button label format
| State | Label |
|---|---|
| Not set | `Mon 14 —` |
| IN | `Mon 14 ✅` |
| OUT with reason | `Mon 14 ❌VL` |
| Split (IN/OUT) | `Mon 14 ↔️` |

### Confirm behaviour
- Submits all days where status is set (skips `—` days)
- Calls existing `storeAndConfirm` with the batch of records
- Shows confirmation message
- Re-displays Reply Keyboard

### "All IN" button — label changes based on state
- When 0 days set: label is "✅ All IN this week" — sets all 5 days and confirms
- When ≥1 day set: label changes to "✅ All IN remaining" — fills only unset days and confirms
- Both variants immediately submit without extra tap

---

## 3. Session Design

New `weekSessions` Map (separate from existing `sessions` and `regSessions`):

```js
weekSessions: Map<telegramId, {
  step: 'GRID' | 'DAY_STATUS' | 'DAY_SPLIT_AM' | 'DAY_SPLIT_PM' | 'DAY_REASON' | 'DAY_REASON_TEXT',
  weekDates: string[],           // ['2026-04-14', ..., '2026-04-18']
  days: Record<string, {         // keyed by ISO date string
    status: 'IN' | 'OUT',
    reason: string | null,
    notes: string,
    splitDay: boolean,
    amStatus?: 'IN' | 'OUT',
    pmStatus?: 'IN' | 'OUT',
    outReason?: string | null,
  }>,
  currentDay: string | null,     // date being edited right now
  chatId: number,
  messageId: number,             // the grid message (edited in-place)
}>
```

---

## 4. Callback Data Format

New prefix for week grid callbacks (avoids collision with existing callbacks):

| Callback data | Meaning |
|---|---|
| `week_day:2026-04-14` | Officer tapped a day in the grid |
| `week_status:IN` | Status picked for currentDay |
| `week_status:OUT` | Status picked for currentDay |
| `week_status:SPLIT` | Split day picked for currentDay |
| `week_am:IN` / `week_am:OUT` | AM status for split day |
| `week_pm:IN` / `week_pm:OUT` | PM status for split day |
| `week_reason:MC` (etc.) | Reason for OUT portion |
| `week_reason:OTHER` | Triggers text input step |
| `week_back` | Return to grid from day picker |
| `week_all_in` | Set all unset days to IN and confirm |
| `week_confirm` | Submit all set days |

---

## 5. Files Changed

| File | Change |
|---|---|
| `server/src/bot/telegram.js` | Add `weekSessions` Map, `buildWeekGrid()`, `handleWeekCallback()`, `showReplyKeyboard()`, update `handleMessage` and `handleCallbackQuery` |
| `server/src/bot/parser.js` | No changes — `expandRecords`, `getDayISO`, `getMondayOfWeek`, `getNextWeekMonday` reused as-is |

No schema changes — records stored identically to current single-day flow.

---

## 6. What Stays Unchanged

- Single-day inline keyboard flow (Status → Reason → Date)
- Keyword shortcuts (`in`, `mc`, `mc tmr`, etc.)
- Self-registration wizard
- `storeAndConfirm` and all DB logic
- `digest.js` — reads records the same way

---

## 7. Edge Cases

| Case | Handling |
|---|---|
| Officer taps "Plan This Week" on a Friday | Grid shows only Friday (remaining days of week) |
| Officer taps "Plan This Week" on a weekend | Grid shows full Mon–Fri of the upcoming week |
| Officer confirms with 0 days set | Bot replies "Nothing set yet — tap a day first 😄", grid stays open |
| Officer has an existing record for a day | Grid shows that day pre-filled with current status on open |
| Stale week grid (session expired) | Same as existing: "This keyboard has expired 😅 Say anything to start again" |
| Officer types text while in week session at non-text step | Week session cleared, text handled normally (keyword match or new single-day keyboard) |
