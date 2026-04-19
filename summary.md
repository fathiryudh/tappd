# Tappd — Recent Changes Summary

## Holiday / Leave Range Feature

Officers can now book or cancel a block of leave in a single message instead of reporting day by day. Weekends are skipped automatically, existing records are overwritten, and ranges longer than 60 working days are rejected.

### Text shortcut (any leave type)

```
ovl 21/4 to 30/4       → OUT (OVL) for every working day in that range
vl 5 may to 9 may      → OUT (VL) for working days in that range
mc 21/4 to 25/4        → OUT (MC) for working days in that range
wfh 28/4 to 2/5        → OUT (WFH) across the two weeks
cancel 21/4 to 30/4    → deletes all leave records in that range (days go back to unconfirmed)
```

### `/holiday` guided command

Type `/holiday` and the bot walks through three steps:

1. Enter start date (`21/4` or `21 Apr`)
2. Enter end date
3. Confirm — bot shows how many working days will be marked OUT (OVL)

Tap **Yes, confirm** to save or **Cancel** to stop at any point.

---

## Bug Fixes

### OUT officers no longer nudged in the morning

The 7:30 AM SGT nudge was using UTC midnight instead of the Singapore date, causing officers who had already submitted OUT records to appear unreported. Fixed by computing the SGT date correctly before querying.

### Mark-all-read no longer fails with 401

When the 15-minute access token expired, clicking "Mark all as read" on the dashboard returned a 401 error and did nothing. Fixed by adding an Axios interceptor that automatically refreshes the token and retries the request transparently.

### Refresh button now shows loading state

Clicking the refresh button in the roster view previously updated silently in the background. It now shows the loading skeleton so the user knows a refresh is happening.

---

## Bot Changes

### HQ replaces Appointment

The "Appointment" reason button in the bot has been renamed to **HQ** throughout — inline keyboards, the parser, and the quick-reference cheat sheet.

### Updated command menu

The bot's `/` command list now includes:

| Command | Description |
|---|---|
| `/report` | Log attendance for today |
| `/status` | Check today's attendance status |
| `/holiday` | Mark yourself OVL for a date range |

---

## Branding

- Tappd bot logo added as the browser tab favicon.
