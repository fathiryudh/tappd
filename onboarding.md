# Tappd — Officer Onboarding Guide

## What is Tappd?

Tappd is an attendance management system built for SCDF. Officers report their daily attendance through a **Telegram bot**. Admins view and track all attendance records through a **web dashboard**.

There are two sides to the system:

| Who | Tool | Purpose |
|-----|------|---------|
| Officers | Telegram Bot | Report daily attendance, plan the week, view roster |
| Admins | Web Dashboard | View attendance, manage the officer roster, receive notifications |

---

## For Officers — Getting Started on Telegram

### Step 1: Find the Bot

Search for the bot on Telegram (your admin will give you the bot username, e.g. `@YourUnitBot`).

### Step 2: Register

Send `/start` to the bot.

The bot will ask you to **share your phone number** (tap the button it provides — do not type it manually). This links your Telegram account to your unit's roster.

Once registered, the bot will ask you to fill in your profile:
- **Name** — your full name
- **Rank** — e.g. CPT, LTA, SGT
- **Division** — select from the list
- **Branch** — select from the list

You can update any of these later with `/editprofile`.

### Step 3: Use the Persistent Menu

After registration, a persistent reply keyboard appears at the bottom of the chat with quick-access buttons:

| Button | What it does |
|--------|-------------|
| Report Today | Log your attendance for today |
| My Status | Check what you have logged for today |
| Plan This Week | Set attendance for each day of this week |
| Plan Next Week | Set attendance for all of next week |
| View Roster | See today's full attendance roster |
| Edit Profile | Update your name, rank, division, branch, or phone |

---

## Bot Commands (Full List)

| Command | Description |
|---------|-------------|
| `/start` | Register or view your profile |
| `/report` | Log attendance for today |
| `/status` | Check today's attendance status |
| `/holiday` | Mark yourself OVL (overseas leave) for a date range |
| `/roster` | View today's attendance roster |
| `/editprofile` | Edit your profile details |
| `/deregister` | Remove your profile and all attendance history |

---

## Reporting Attendance

When you tap **Report Today** or send `/report`, the bot will guide you through three choices:

### 1. IN
You are present for the full day. Select **IN** and confirm the date.

### 2. OUT
You are absent. Select **OUT**, then choose a reason:

| Reason | Meaning |
|--------|---------|
| MC | Medical certificate |
| VL | Vacation leave |
| OVL | Overseas leave |
| OIL | Off-in-lieu |
| WFH | Work from home |
| Course | On a course |
| HQ | At HQ / away from unit |
| Family Emergency | Family emergency |
| Other | Any other reason (you type it in) |

### 3. Split Day (AM / PM)
If your morning and afternoon attendance differ (e.g. AM IN, PM MC), select **Split Day**. The bot will ask for your AM status and reason, then your PM status and reason separately.

---

## Planning the Week

Tap **Plan This Week** or **Plan Next Week** to open the weekly grid.

- You'll see buttons for Mon–Fri of the selected week, labelled with their current status (blank if not yet set).
- Tap any day to set its status (IN, OUT, or Split Day).
- Use **Set All In** / **Set Remaining In** to fill unset days quickly.
- Tap **Confirm** when done. All days are saved in one go.

---

## Checking Your Status

Tap **My Status** or send `/status` to see what you have logged for today.

If nothing is logged yet, the bot will offer to open the reporting flow immediately.

---

## Marking Overseas Leave (OVL)

Send `/holiday` to mark a date range as OVL in one step without going day by day:

1. Bot asks for the **start date** (type it, e.g. `25 Apr` or `25/04`)
2. Bot asks for the **end date**
3. Bot shows the list of weekdays in that range and asks you to confirm
4. All those days are saved as OUT (OVL)

---

## Viewing the Roster

Tap **View Roster** or send `/roster` to see today's full attendance list — who is IN, who is OUT, and their reasons.

---

## Editing Your Profile

Send `/editprofile` to update any of:
- Name
- Rank
- Division
- Branch
- Phone number

Select the field from the inline keyboard, type the new value, and confirm.

---

## Deregistering

Send `/deregister` to remove your profile and all your attendance history from the system. You will be asked to confirm before anything is deleted. This is permanent.

---

## Tips

- **You can report for any day this week**, not just today. When prompted for a date, you'll see buttons for Today, Tomorrow, and each weekday.
- **Split Day** is useful for partial MC, half-day VL, or arriving late / leaving early.
- **Plan Next Week** is best done on Thursday or Friday so your admin can see the upcoming week's availability early.
- **Your phone number must match** what is in the unit roster. If registration fails, contact your admin.

---

## For Admins — Web Dashboard

### Logging In

Go to the dashboard URL provided by your system admin. Log in with your email and password.

### Dashboard Views

The dashboard has two main views, accessible from the top navigation (desktop) or the bottom tab bar (mobile):

#### Attendance (Weekly View)
- Shows all officers' attendance for the current week in a grid: Mon–Fri across columns, officers down rows.
- Each cell shows the officer's status for that day: **IN**, **OUT (reason)**, or **Split (AM/PM)**.
- Use the **Division** and **Branch** filters to narrow the view. Filters are pinned — they persist across sessions.
- The view auto-refreshes every 30 seconds and also refreshes instantly when a new notification arrives.

#### Roster (Directory)
- Shows all registered officers with their name, rank, division, branch, and phone.
- You can add, edit, or remove officers directly from this view.
- Officers who have not yet registered via Telegram will show no Telegram ID.

### Notifications

The bell icon (top right) shows incoming attendance events. A red dot appears when there are unread notifications. Each notification shows:
- Which officer submitted a report
- What their status is
- Which date it applies to

Click **Mark all read** to clear the badge.

### Adding Officers Before They Register

You can pre-create officer records from the Roster view (add name, rank, division, branch, phone). When the officer sends `/start` on Telegram and shares their phone number, their Telegram account will be linked to the existing record automatically.

---

## Architecture (For Technical Reference)

```
Telegram Bot  ──►  Express API  ──►  Supabase PostgreSQL
                        │
                   React Dashboard (Vite)
```

- **Bot**: runs on the same Express server, receives Telegram webhooks
- **Database**: Supabase Postgres, accessed via Prisma
- **Dashboard**: React 19 + Vite, served separately (or from the same host)
- **Auth**: httpOnly cookie sessions

---

## Quick Reference Card (Print and Share)

```
TAPPD BOT — QUICK COMMANDS

/start        → Register / view profile
/report       → Log today's attendance
/status       → Check today's status
/holiday      → Mark OVL for a date range
/roster       → View today's roster
/editprofile  → Update your profile
/deregister   → Remove your account

Attendance options: IN | OUT | Split Day (AM/PM)

OUT reasons: MC · VL · OVL · OIL · WFH · Course · HQ · Family Emergency · Other
```
