# Tappd — Officer Onboarding Guide

## What is Tappd?

Tappd is the attendance management system for your unit. Officers report daily attendance through the **Telegram bot**. Admins track everything through the **web dashboard**.

| Who | Tool | What you do |
|-----|------|-------------|
| Officers | Telegram Bot | Report attendance, plan the week, view the roster |
| Admins | Web Dashboard | View attendance, manage officers, receive notifications |

---

## Part 1: Getting Started (Officers)

### Step 1 — Find the Bot

Open Telegram and search for your unit's bot (your admin will give you the username, e.g. `@YourUnitBot`). Tap **Start**.

### Step 2 — Verify Your Identity

The bot will ask you to share your phone number. **Tap the button it provides** — do not type your number manually. This links your Telegram account to your unit's roster.

> If verification fails, your phone number may not be in the roster yet. Contact your admin to get added.

### Step 3 — Fill in Your Profile

After verification, the bot will prompt you to complete your profile. You can update any field at any time with `/editprofile`.

| Field | What to enter |
|-------|---------------|
| Name | Your full name |
| Rank | e.g. CPT, LTA, SGT, CPL |
| Division | Select from the list |
| Branch | Select from the list |

### Step 4 — Use the Menu

After registration, a persistent menu appears at the bottom of your chat. You will use this every day.

| Button | What it does |
|--------|-------------|
| **Report Today** | Log your attendance for today |
| **My Status** | See what you have already logged for today |
| **Plan This Week** | Set attendance for each day of the current week |
| **Plan Next Week** | Set attendance for all days of next week |
| **View Roster** | See today's full attendance list for your unit |
| **Edit Profile** | Update your name, rank, division, branch, or phone |

---

## Part 2: Reporting Attendance

### Reporting Today

Tap **Report Today** or send `/report`. The bot will ask for your status:

#### IN — You are present for the full day

Select **IN**. Your attendance is saved immediately. No further input needed.

#### OUT — You are absent

Select **OUT**. The bot will ask for a reason:

| Reason | Meaning |
|--------|---------|
| MC | Medical certificate |
| VL | Vacation leave |
| OVL | Overseas leave |
| OIL | Off-in-lieu |
| WFH | Work from home |
| Course | Attending a course |
| HQ | At HQ or away from unit |
| Family Emergency | Family emergency |
| Other | Any other reason — you will type it in |

If you select **Other**, type your reason in the next message. It will be saved in **ALL CAPS** automatically for consistency.

#### Split Day — Your morning and afternoon differ

Select **Split Day** if your AM and PM attendance are different — for example, AM IN then PM MC, or AM MC then PM IN.

The bot will ask:
1. **AM status** — IN or OUT
2. **AM reason** (if OUT) — same options as above
3. **PM status** — IN or OUT
4. **PM reason** (if OUT) — same options as above

Your attendance is saved as a split record (e.g. `AM IN / PM OUT(MC)`).

---

### Reporting for a Specific Date

When the bot asks **Choose date**, you can report for:

| Option | What it means |
|--------|---------------|
| Today | The current date |
| Tmr | Tomorrow |
| Mon – Fri | A specific weekday this week |

> Weekends are blocked — the bot will not let you log attendance for Saturday or Sunday.

---

## Part 3: Planning the Week

Use **Plan This Week** or **Plan Next Week** to set your attendance for multiple days at once. This is the most efficient way to plan ahead.

### How it works

1. A grid appears showing Mon–Fri for the selected week
2. Each day button shows its current status:
   - No label — not yet set
   - `IN` — marked IN
   - `OUT XXXX` — marked OUT (first 4 letters of reason shown)
   - `SPLIT` — marked as a split day
3. Tap any day to set or update its status
4. Repeat for as many days as needed
5. Tap **Confirm (N)** to save all N days at once

### Shortcuts

- **Set All In** — marks all unset days as IN in one tap
- **Set Remaining In** — marks only the remaining unset days as IN (appears after you have set at least one day)

> **Tip:** Do **Plan Next Week** on Thursday or Friday so your admin can see next week's availability early.

---

## Part 4: Marking Overseas Leave (OVL)

Use `/holiday` to mark a full date range as OVL without going day by day.

**Steps:**
1. Send `/holiday`
2. Bot asks: **What is your start date?** — type it (e.g. `25 Apr` or `25/4`)
3. Bot asks: **What is your end date?** — type it the same way
4. Bot shows the list of working days in that range and asks you to confirm
5. Tap **Yes, confirm** — all those days are saved as OUT (OVL)

> Only weekdays are counted. Weekends within the range are skipped automatically.
> Maximum range is 60 working days.

---

## Part 5: Checking Your Status

Tap **My Status** or send `/status` to see what you have logged for today.

- If nothing is logged yet, the bot will show a message saying so
- If you have already reported, the bot shows your current status with an **Edit Today** button in case you need to change it

---

## Part 6: Viewing the Roster

Tap **View Roster** or send `/roster` to see today's full attendance list.

The roster is grouped by branch and shows:
- Each officer's name
- Their status: **IN**, **OUT (reason)**, **AM/PM split**, or **Not reported**
- A summary at the top: `IN X / OUT X (breakdown) / Not reported X`

By default, the roster shows your division. If you are admin, you can view another division by sending `/roster DivisionName`.

---

## Part 7: Editing Your Profile

Send `/editprofile` or tap **Edit Profile**. An inline menu appears with these fields:

| Field | Notes |
|-------|-------|
| Name | Your full name as it appears on the roster and digest emails |
| Rank | Short form (CPT, LTA, SGT, etc.) |
| Division | Select from the list, or type a new one if yours is missing |
| Branch | Select from the list, or type a new one |
| Phone | Tap the Share button to update — do not type manually |

Tap **Done** when finished.

---

## Part 8: Deregistering

Send `/deregister` to permanently remove your profile and all attendance history.

The bot will ask you to type `YES` to confirm. **This cannot be undone.**

> You can re-register at any time by sending `/start` again, but your previous history will not be restored.

---

## Full Command Reference

| Command | Description |
|---------|-------------|
| `/start` | Register or view your profile |
| `/report` | Log attendance for today |
| `/status` | Check today's attendance status |
| `/holiday` | Mark yourself OUT (OVL) for a date range |
| `/roster` | View today's attendance roster |
| `/weekplan` | View your current week's attendance summary |
| `/editprofile` | Edit your profile details |
| `/deregister` | Remove your profile and all attendance history |

---

## Tips

- **You can edit today's status at any time** — tap My Status, then Edit Today.
- **Split Day** is useful for partial MC, half-day VL, or arriving late or leaving early.
- **Free-text reasons** (when you choose Other) are stored in ALL CAPS so they are consistent with the preset reasons like MC and VL.
- **Your phone number must match** what is in the unit roster. If registration fails, contact your admin.
- **Plan Next Week on Thu/Fri** — gives your admin the most visibility before the week starts.

---

## For Admins — Web Dashboard

### Logging In

Go to the dashboard URL your system admin provides. Log in with your email and password.

### Dashboard Views

#### Attendance (Weekly View)
- Shows all officers' attendance for the current week in a grid: Mon–Fri as columns, officers as rows
- Each cell shows: **IN**, **OUT (reason)**, **Split (AM/PM)**, or blank (not reported)
- Use the **Division** and **Branch** dropdowns to filter the view — filters persist across sessions
- Auto-refreshes every 30 seconds and also refreshes instantly when a new notification arrives

#### Roster (Directory)
- Shows all registered officers with name, rank, division, branch, and phone
- Add, edit, or remove officers from this view
- Officers who have not yet registered via Telegram show no Telegram ID — they can still be pre-created here

### Notifications

The bell icon (top right) shows incoming attendance events. A red dot appears when there are unread notifications. Each notification shows which officer submitted a report, their status, and which date it applies to. Tap **Mark all read** to clear the badge.

### Settings

The gear icon (bottom of sidebar on desktop, or inside the menu on mobile) opens the Settings page.

#### Department Scope
Set which Division and Branch your daily digest email covers. Leave both blank to include all officers.

- Select a **Division** to filter the digest to that division only
- Selecting a division enables the **Branch** dropdown to filter further

Changes save automatically on selection.

#### Digest Emails
The daily digest email (sent at 8:30 AM SGT on weekdays) normally goes to your account email. You can add extra recipients here.

- Type an email address and tap **Add** (or press Enter)
- Remove any address by tapping the × next to it
- Leave the list empty to use your account email as the only recipient

### Adding Officers Before They Register

Pre-create officer records from the Roster view (add name, rank, division, branch, phone). When the officer sends `/start` on Telegram and shares their phone number, their Telegram account is automatically linked to the existing record.

---

## Architecture (Technical Reference)

```
Telegram Bot  ──►  Express API  ──►  Supabase PostgreSQL
                        │
                   React Dashboard (Vite)
```

- **Bot** — runs on the same Express server, receives Telegram webhooks
- **Database** — Supabase Postgres, accessed via Prisma
- **Dashboard** — React 19 + Vite
- **Auth** — httpOnly cookie sessions
- **Cron jobs** — Morning nudge at 7:30 AM SGT (Mon–Fri), digest email at 8:30 AM SGT (Mon–Fri), triggered via cron-job.org with `x-cron-secret` header auth

---

## Quick Reference Card

```
TAPPD BOT — QUICK COMMANDS

/start        → Register / view profile
/report       → Log today's attendance
/status       → Check today's status
/holiday      → Mark OVL for a date range
/roster       → View today's roster
/weekplan     → View this week's plan
/editprofile  → Update your profile
/deregister   → Remove your account

Attendance options:
  IN | OUT | Split Day (AM/PM)

OUT reasons:
  MC · VL · OVL · OIL · WFH · Course · HQ · Family Emergency · Other
```
