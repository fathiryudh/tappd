# Yappd

Attendance reporting system for SCDF 2nd Division HQ. Officers report daily attendance through a Telegram bot. Admins view and manage the roster from a web dashboard.

---

## Table of Contents

- [For Officers — Telegram Bot](#for-officers--telegram-bot)
  - [Getting Started](#getting-started)
  - [The Menu Buttons](#the-menu-buttons)
  - [Reporting Attendance](#reporting-attendance)
  - [Absence Reasons](#absence-reasons)
  - [Split Day (AM/PM)](#split-day-ampm)
  - [Keyword Shortcuts](#keyword-shortcuts)
  - [Reporting for Tomorrow](#reporting-for-tomorrow)
  - [Multi-Day Reporting](#multi-day-reporting)
  - [Planning Your Week](#planning-your-week)
  - [Checking Your Status](#checking-your-status)
  - [Viewing the Roster](#viewing-the-roster)
  - [Editing Your Profile](#editing-your-profile)
  - [Removing Your Profile](#removing-your-profile)
  - [Morning Reminders](#morning-reminders)
  - [Weekends](#weekends)
  - [NSF Officers](#nsf-officers)
- [For Admins — Web Dashboard](#for-admins--web-dashboard)
  - [Logging In](#logging-in)
  - [Attendance Tab](#attendance-tab)
  - [Roster Tab](#roster-tab)
  - [Notifications](#notifications)
  - [Daily Email Digest](#daily-email-digest)
- [Quick Reference](#quick-reference)

---

## For Officers — Telegram Bot

### Getting Started

1. Open Telegram and search for the bot (your admin will give you the bot name or a direct link).
2. Send `/start`.
3. The bot will ask you to share your phone number — tap the **Share Phone Number** button that appears.
4. Your number is matched against the roster. If it is found, you are verified and the main menu appears.
5. If the bot says your number is not in the system, contact your admin to get added.

> You only need to do this once. Your Telegram account stays linked to your profile from then on.

---

### The Menu Buttons

After verification, a persistent keyboard appears at the bottom of your chat. It stays there so you can tap quickly without typing commands.

| Button | What it does |
|---|---|
| **Report Today** | Log your attendance status for today |
| **My Status** | Check what status you have logged for today |
| **Plan This Week** | Set your status for remaining days this week |
| **Plan Next Week** | Set your status for all of next week |
| **View Roster** | See today's attendance for your division |
| **Edit Profile** | Update your name, rank, division, branch, or phone |

---

### Reporting Attendance

Tap **Report Today** or type `/report`.

You will be shown an inline keyboard with three status options:

- **IN** — you are reporting to office
- **OUT** — you are absent (you will be asked for a reason)
- **Split Day** — your morning and afternoon are different (e.g. IN the morning, WFH in the afternoon)

Once you confirm, the bot saves your record and shows a summary. You can edit it at any time by tapping **Report Today** again.

---

### Absence Reasons

When you select **OUT** (or an OUT half for a split day), the bot asks for your reason:

| Reason | Meaning |
|---|---|
| **MC** | Medical certificate / sick |
| **VL** | Vacation leave |
| **OVL** | Overseas leave |
| **OIL** | Off-in-lieu |
| **WFH** | Work from home |
| **Course** | Training or course |
| **Appointment** | Medical or other appointment |
| **Family Emergency** | Family emergency |
| **Other** | Anything else — you type a short description |

---

### Split Day (AM/PM)

Select **Split Day** to log different statuses for your morning and afternoon.

The bot will ask:

1. AM status (IN or OUT) — and a reason if OUT
2. PM status (IN or OUT) — and a reason if OUT

Your record will be saved as, for example, `AM IN / PM OUT(WFH)`.

---

### Keyword Shortcuts

You do not need to use the keyboard every time. Type any of these words and the bot will save your status immediately without asking follow-up questions.

**Reporting IN:**

| What you type | What is saved |
|---|---|
| `in` | IN today |
| `reporting` | IN today |
| `roger` | IN today |
| `available` | IN today |
| `报到` | IN today |

**Reporting OUT:**

| What you type | What is saved |
|---|---|
| `mc` / `sick` / `unwell` / `fever` | OUT — MC |
| `vl` / `al` | OUT — VL |
| `ovl` / `overseas` | OUT — OVL |
| `oil` | OUT — OIL |
| `wfh` | OUT — WFH |
| `course` / `training` | OUT — Course |

All keywords are case-insensitive. `IN`, `In`, `in` all work the same way.

---

### Reporting for Tomorrow

Add `tmr`, `tmrw`, or `tomorrow` to any keyword shortcut to report for the next day instead of today.

Examples:
- `mc tmr` — OUT (MC) for tomorrow
- `in tmrw` — IN tomorrow
- `wfh tomorrow` — WFH tomorrow

---

### Multi-Day Reporting

You can report multiple days at once by separating entries with commas or by listing them in a single message.

**Comma-separated:**
```
mon in, tue mc, wed vl
```
```
14/4 in, 15/4 mc, 16/4 wfh
```

**Space-separated (no commas needed):**
```
mon in tue mc wed vl thu in fri in
```

**Date formats supported:**
- Day names: `mon`, `tue`, `wed`, `thu`, `fri` (and full names like `monday`)
- Slash dates: `14/4`, `14/04`, `14/4/2026`
- Day + month name: `14 apr in`, `15 april mc`

The bot saves all the records at once and confirms each one.

---

### Planning Your Week

**Plan This Week** — Opens a grid of the remaining days this week (from today onwards). Tap each day to set a status, then tap **Confirm** to save all at once. You can also tap **Set All In** (or **Set Remaining In**) to fill every unset day as IN in one tap.

**Plan Next Week** — Same as above but for the full Mon–Fri of next week. Useful to plan ahead on Fridays or over the weekend.

You can also type `/weekplan` to see a text summary of your current week's plan.

---

### Checking Your Status

Tap **My Status** to see what is logged for today.

- If you have a record: shows your current status and reason.
- If you have not reported yet: the bot tells you and reminds you to update.

---

### Viewing the Roster

Tap **View Roster** or type `/roster` to see today's attendance summary for your division.

The roster shows:
- A count of IN, OUT, and unreported officers
- A breakdown by branch
- Each officer's name and status

Officers can also type `/roster <division name>` to look up a specific division.

> NSF officers always see their own division's roster.

---

### Editing Your Profile

Tap **Edit Profile** or type `/editprofile` to update any of the following:

- **Name** — your display name shown on the roster
- **Rank** — e.g. CPT, LTA, SGT
- **Division** — choose from the list or type a new one
- **Branch** — choose from the list or type a new one
- **Phone** — changing your phone re-links your account to the new number

Tap **Done** when you are finished. Changes take effect immediately on the roster.

---

### Removing Your Profile

Type `/deregister` to remove your profile and all your attendance history.

The bot will ask you to confirm by typing **YES** in uppercase. Anything else cancels the deletion.

> This is permanent. If you re-register later, your attendance history will not be restored.

---

### Morning Reminders

The bot sends automatic reminder messages on weekday mornings to officers who have not yet logged their status.

| Time (SGT) | What happens |
|---|---|
| **7:30 AM** | First nudge sent to all officers with no status for today |
| **8:30 AM** | Second nudge sent to officers still unreported; admin receives the daily email digest |

The nudge message reads:
> *Morning [Name]. No status logged yet for today. Update before 0830. Type in, mc, vl or tap Report Today.*

If you have already reported before 7:30 AM, you will not receive any nudge.

---

### Weekends

The bot does not accept attendance reports on Saturdays and Sundays. If you tap **Report Today** or type any keyword shortcut on a weekend, the bot will reply:

> *It's the weekend — no need to report today. Use Plan Next Week to set your status for next week.*

Use **Plan Next Week** on the weekend to get ahead and plan the whole of next week.

---

### NSF Officers

NSF officers are registered in the system but cannot log attendance themselves.

- The bot recognises NSF accounts and will not let them submit a report.
- NSFs can still use `/roster` or **View Roster** to see the division's daily attendance.
- NSF morning nudges are suppressed.

---

## For Admins — Web Dashboard

### Logging In

Go to the dashboard URL provided by your system administrator. Use your email and password to log in.

- **Session length** — your login is kept for 7 days. After that you will need to log in again.
- **Forgot password** — contact the system administrator; there is no self-service reset.

New admin accounts are created from the `/register` page. Each admin manages their own set of officers independently.

---

### Attendance Tab

The default view when you open the dashboard. Shows a Mon–Fri grid for the current week with one row per officer.

**Reading the grid:**

| Cell colour / label | Meaning |
|---|---|
| Green / **IN** | Officer reported in |
| Red / reason shown | Officer is out with a reason (MC, VL, etc.) |
| Yellow / **Split** | Officer has a split AM/PM record |
| Grey / blank | No report submitted yet |
| **?** | No report submitted yet (same as blank) |

**Navigation:**

- The inline **← / →** arrows next to the week label step back or forward by one week.
- The **Today** button returns to the current week.
- On weekends the view opens on next week by default (since the current week is over).

**Filters:**

Use the **Division** and **Branch** dropdowns to narrow the roster. Pinning a filter saves it in your browser so it persists between sessions.

**Auto-refresh:**

The attendance view refreshes automatically every 15 seconds in the background. It also refreshes immediately whenever a new officer report comes in, so the grid stays current without any manual action.

---

### Roster Tab

The **Roster** tab shows your full officer directory.

**What you can do:**

- **Add officer** — fill in name, rank, phone number, division, branch, and role (Officer or NSF). Phone is required and must be unique.
- **Edit officer** — click on any officer to update their details. Changing their phone number unlinks their Telegram account and they will need to re-verify via `/start`.
- **Delete officer** — removes the officer and all their attendance history.
- **Filter** — same Division and Branch filters apply here.

---

### Notifications

A bell icon in the top bar shows unread notification count.

Every time an officer submits or updates their attendance via the bot, a notification event is created and appears here.

**Live toasts:**

New reports trigger a small popup (toast) in the corner of the screen with the officer's name and status. Up to 2 toasts appear at once and each disappears after 3 seconds. You can also dismiss them manually with the × button.

**Notification panel:**

Click the bell to open the full notification list. Tap **Mark all read** to clear the unread count.

---

### Daily Email Digest

At **8:30 AM SGT** on weekdays the system sends a daily attendance email to the address configured as `DIGEST_EMAIL`.

The email includes:
- Date and day of week
- Each officer's status: `[IN]`, `[OUT]`, or `[?]` (unconfirmed)
- A summary count: *IN: X · OUT: Y · Unconfirmed: Z*

The email is sent in both plain text and HTML. The HTML version colour-codes each row green for IN, red for OUT, and yellow for unconfirmed.

---

## Quick Reference

### Bot Commands

| Command | Description |
|---|---|
| `/start` | Register or view your profile |
| `/report` | Log attendance for today |
| `/status` | Check today's status |
| `/roster` | View today's division roster |
| `/weekplan` | See your current week plan |
| `/editprofile` | Edit your profile details |
| `/deregister` | Remove your profile and attendance history |

### Keyword Cheat Sheet

```
in / reporting / roger / available / 报到   →  IN today
mc / sick / unwell / fever                 →  OUT (MC)
vl / al                                    →  OUT (VL)
ovl / overseas                             →  OUT (OVL)
oil                                        →  OUT (OIL)
wfh                                        →  OUT (WFH)
course / training                          →  OUT (Course)

Add "tmr" / "tmrw" / "tomorrow" to any of the above to report for the next day.

Multi-day: "mon in, tue mc, wed wfh"  or  "14/4 in, 15/4 mc"
```
