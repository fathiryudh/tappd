# Cron Reliability & Digest Email Scoping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cron jobs fire reliably via HTTP endpoints callable by cron-job.org, and scope each admin's daily digest email to their division/branch.

**Architecture:** Extract cron logic into standalone async functions in `server/src/cron/jobs.js`; expose them behind secret-authenticated POST endpoints; refactor `sendDailyDigest` to accept a recipients array and Prisma where clause so `runDigestEmail` can iterate over all users and send each a scoped digest. Add a minimal Settings page (scope dropdowns + email list) accessible from the Dashboard nav.

**Tech Stack:** Node.js/Express, Prisma 7 (PostgreSQL), node-cron (kept as fallback), React 19 + Vite, @phosphor-icons/react, axios

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `server/src/bot/digest.js` | Modify | Change `sendDailyDigest` signature to `(recipients, officerWhere)` |
| `server/src/cron/jobs.js` | Create | `runMorningNudge()` and `runDigestEmail()` |
| `server/tests/cron/jobs.test.js` | Create | Unit tests for both job functions |
| `server/src/routes/cron.routes.js` | Create | POST /nudge and POST /digest with secret auth |
| `server/src/routes/settings.routes.js` | Create | GET/PUT /scope and GET/PUT /digest-emails |
| `server/src/routes/index.js` | Modify | Mount `/cron` and `/settings` routers |
| `server/server.js` | Modify | Cron schedules call `runMorningNudge`/`runDigestEmail` |
| `server/.env.example` | Modify | Add `CRON_SECRET` |
| `server/app.js` | Modify | Add `/settings` to `spaRoutes` |
| `client/src/api/settings.api.js` | Create | API calls for scope and digest-emails endpoints |
| `client/src/pages/Settings.jsx` | Create | Two-section settings page |
| `client/src/App.jsx` | Modify | Add `/settings` protected route |
| `client/src/pages/Dashboard.jsx` | Modify | Add gear icon link to `/settings` in desktop sidebar and mobile FAB panel |

---

## Task 1: Refactor `sendDailyDigest` to accept scoped args

**Files:**
- Modify: `server/src/bot/digest.js`

The function currently takes `digestEmail` (single string) and queries all officers. Change it to `sendDailyDigest(recipients, officerWhere = {})` where `recipients` is `string[]` and `officerWhere` is merged into the Prisma `findMany` where clause.

- [ ] **Step 1: Write the failing test**

Create `server/tests/cron/digest-scoped.test.js`:

```js
'use strict'

jest.mock('../src/config/prisma', () => ({
  officer: {
    findMany: jest.fn(),
  },
}))
jest.mock('../src/utils/mailer', () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({}) },
}))

const prisma = require('../src/config/prisma')
const { transporter } = require('../src/utils/mailer')
const { sendDailyDigest } = require('../src/bot/digest')

beforeEach(() => jest.clearAllMocks())

describe('sendDailyDigest', () => {
  const mockOfficers = [
    { id: '1', name: 'Alice', telegramName: null, telegramId: null, availability: [] },
    { id: '2', name: 'Bob',   telegramName: null, telegramId: null,
      availability: [{ status: 'IN', reason: null }] },
  ]

  test('sends to all recipients in array', async () => {
    prisma.officer.findMany.mockResolvedValue(mockOfficers)

    await sendDailyDigest(['a@example.com', 'b@example.com'])

    expect(transporter.sendMail).toHaveBeenCalledTimes(1)
    const call = transporter.sendMail.mock.calls[0][0]
    expect(call.to).toBe('a@example.com, b@example.com')
  })

  test('passes officerWhere to prisma findMany', async () => {
    prisma.officer.findMany.mockResolvedValue(mockOfficers)

    await sendDailyDigest(['a@example.com'], { divisionId: 'div-1' })

    expect(prisma.officer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { divisionId: 'div-1' },
      })
    )
  })

  test('skips send when recipients array is empty', async () => {
    await sendDailyDigest([])
    expect(transporter.sendMail).not.toHaveBeenCalled()
    expect(prisma.officer.findMany).not.toHaveBeenCalled()
  })

  test('skips send when officers list is empty', async () => {
    prisma.officer.findMany.mockResolvedValue([])
    await sendDailyDigest(['a@example.com'])
    expect(transporter.sendMail).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/fathir/Documents/yappd/server && npm test -- tests/cron/digest-scoped.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — wrong number of args / `to` field is a string not array.

- [ ] **Step 3: Update `server/src/bot/digest.js`**

Replace the function signature and update the body:

```js
const prisma = require('../config/prisma')
const { transporter } = require('../utils/mailer')
const { localISODate, toUTCStartOfDay } = require('../utils/date')

async function sendDailyDigest(recipients, officerWhere = {}) {
  if (!recipients || recipients.length === 0) {
    console.warn('sendDailyDigest: no recipients — skipping')
    return
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const officers = await prisma.officer.findMany({
    where: officerWhere,
    include: {
      availability: { where: { date: today }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })

  if (officers.length === 0) return

  const rows = officers.map(o => {
    const avail = o.availability[0]
    const displayName = o.name || o.telegramName || o.telegramId || 'Unknown'
    if (!avail) {
      return { label: '[?]', displayName, reasonStr: 'Unconfirmed', status: 'unconfirmed' }
    }
    if (avail.status === 'IN') {
      return { label: '[IN]', displayName, reasonStr: '', status: 'in' }
    }
    const reasonStr = avail.reason ? `(${avail.reason})` : ''
    return { label: '[OUT]', displayName, reasonStr, status: 'out' }
  })

  const countIn = rows.filter(r => r.status === 'in').length
  const countOut = rows.filter(r => r.status === 'out').length
  const countUnconfirmed = rows.filter(r => r.status === 'unconfirmed').length

  const dateStr = today.toLocaleDateString('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const textBody = [
    `Tappd Daily Availability Report`,
    `${dateStr}`,
    ``,
    ...rows.map(r => r.reasonStr ? `${r.label} ${r.displayName} ${r.reasonStr}` : `${r.label} ${r.displayName}`),
    ``,
    `IN: ${countIn} · OUT: ${countOut} · Unconfirmed: ${countUnconfirmed}`,
  ].join('\n')

  const rowColor = s => s === 'in' ? '#f0fdf4' : s === 'out' ? '#fafafa' : '#fefce8'
  const labelColor = s => s === 'in' ? '#16a34a' : s === 'out' ? '#dc2626' : '#ca8a04'

  const htmlBody = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
      <h2 style="margin-bottom:4px">Daily Availability Report</h2>
      <p style="color:#71717a;margin-top:0">${dateStr}</p>
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(r => `
          <tr style="background:${rowColor(r.status)}">
            <td style="padding:6px 8px;font-weight:600;color:${labelColor(r.status)};width:48px">${r.label}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5">${r.reasonStr ? `${r.displayName} ${r.reasonStr}` : r.displayName}</td>
          </tr>`).join('')}
      </table>
      <p style="color:#71717a;font-size:13px;margin-top:12px">IN: ${countIn} · OUT: ${countOut} · Unconfirmed: ${countUnconfirmed}</p>
      <p style="color:#a1a1aa;font-size:12px;margin-top:16px">Sent by Tappd</p>
    </div>
  `

  await transporter.sendMail({
    from: `Tappd <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `Tappd Daily Roster — ${dateStr} (${countIn}/${officers.length} in)`,
    text: textBody,
    html: htmlBody,
  })

  console.log(`Digest sent to ${recipients.join(', ')}: ${countIn}/${officers.length} in`)
}

async function getUnreportedOfficers() {
  const sgtNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const today = toUTCStartOfDay(localISODate(sgtNow))
  return prisma.officer.findMany({
    where: {
      availability: { none: { date: today } },
    },
  })
}

module.exports = { sendDailyDigest, getUnreportedOfficers }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/fathir/Documents/yappd/server && npm test -- tests/cron/digest-scoped.test.js --no-coverage 2>&1 | tail -15
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/fathir/Documents/yappd/server && git add src/bot/digest.js tests/cron/digest-scoped.test.js && git commit -m "Refactor sendDailyDigest to accept recipients array and officerWhere"
```

---

## Task 2: Create `server/src/cron/jobs.js`

**Files:**
- Create: `server/src/cron/jobs.js`
- Create: `server/tests/cron/jobs.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/cron/jobs.test.js`:

```js
'use strict'

jest.mock('../src/config/prisma', () => ({
  user: { findMany: jest.fn() },
}))
jest.mock('../src/bot/digest', () => ({
  sendDailyDigest: jest.fn().mockResolvedValue(undefined),
  getUnreportedOfficers: jest.fn().mockResolvedValue([]),
}))
jest.mock('../src/bot/telegram', () => ({
  nudgeOfficers: jest.fn().mockResolvedValue(undefined),
}))

const prisma = require('../src/config/prisma')
const { sendDailyDigest, getUnreportedOfficers } = require('../src/bot/digest')
const { nudgeOfficers } = require('../src/bot/telegram')
const { runMorningNudge, runDigestEmail } = require('../src/cron/jobs')

beforeEach(() => jest.clearAllMocks())

describe('runMorningNudge', () => {
  test('fetches unreported officers and nudges them', async () => {
    const officers = [{ id: '1', telegramId: '111' }]
    getUnreportedOfficers.mockResolvedValue(officers)

    await runMorningNudge()

    expect(getUnreportedOfficers).toHaveBeenCalledTimes(1)
    expect(nudgeOfficers).toHaveBeenCalledWith(officers)
  })
})

describe('runDigestEmail', () => {
  test('sends digest to each user using digestEmails when set', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'admin@example.com', digestEmails: ['digest@example.com'],
        scopeDivisionId: 'div-1', scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(
      ['digest@example.com'],
      { divisionId: 'div-1' }
    )
  })

  test('falls back to user.email when digestEmails is empty', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'admin@example.com', digestEmails: [],
        scopeDivisionId: null, scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(['admin@example.com'], {})
  })

  test('includes both divisionId and branchId in where when both are set', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@b.com', digestEmails: [],
        scopeDivisionId: 'div-1', scopeBranchId: 'br-1' },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(
      ['a@b.com'],
      { divisionId: 'div-1', branchId: 'br-1' }
    )
  })

  test('sends digest to each user independently', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@a.com', digestEmails: [], scopeDivisionId: null, scopeBranchId: null },
      { id: 'u2', email: 'b@b.com', digestEmails: [], scopeDivisionId: 'div-2', scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledTimes(2)
    expect(sendDailyDigest).toHaveBeenNthCalledWith(1, ['a@a.com'], {})
    expect(sendDailyDigest).toHaveBeenNthCalledWith(2, ['b@b.com'], { divisionId: 'div-2' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/fathir/Documents/yappd/server && npm test -- tests/cron/jobs.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '../src/cron/jobs'`.

- [ ] **Step 3: Create `server/src/cron/jobs.js`**

```js
'use strict'

const prisma = require('../config/prisma')
const { sendDailyDigest, getUnreportedOfficers } = require('../bot/digest')
const { nudgeOfficers } = require('../bot/telegram')

async function runMorningNudge() {
  const unreported = await getUnreportedOfficers()
  await nudgeOfficers(unreported)
  console.log(`Morning nudge: sent to ${unreported.length} officer(s)`)
}

async function runDigestEmail() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    const recipients = user.digestEmails.length > 0 ? user.digestEmails : [user.email]
    const officerWhere = {}
    if (user.scopeDivisionId) officerWhere.divisionId = user.scopeDivisionId
    if (user.scopeBranchId) officerWhere.branchId = user.scopeBranchId
    await sendDailyDigest(recipients, officerWhere)
  }
}

module.exports = { runMorningNudge, runDigestEmail }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/fathir/Documents/yappd/server && npm test -- tests/cron/jobs.test.js --no-coverage 2>&1 | tail -15
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add server/src/cron/jobs.js server/tests/cron/jobs.test.js && git commit -m "Add cron job functions: runMorningNudge and runDigestEmail"
```

---

## Task 3: Create cron HTTP endpoints

**Files:**
- Create: `server/src/routes/cron.routes.js`

- [ ] **Step 1: Create `server/src/routes/cron.routes.js`**

```js
'use strict'

const { Router } = require('express')
const { runMorningNudge, runDigestEmail } = require('../cron/jobs')

const router = Router()

function validateSecret(req, res, next) {
  const secret = req.headers['x-cron-secret']
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  next()
}

router.post('/nudge', validateSecret, async (req, res) => {
  try {
    await runMorningNudge()
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /cron/nudge error:', err)
    res.json({ ok: false, error: err.message })
  }
})

router.post('/digest', validateSecret, async (req, res) => {
  try {
    await runDigestEmail()
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /cron/digest error:', err)
    res.json({ ok: false, error: err.message })
  }
})

// CRON-JOB.ORG SETUP
// Create two jobs at https://cron-job.org (free account)
//
// Job 1 — Morning nudge
//   URL:    POST https://<your-render-url>/api/v1/cron/nudge
//   Header: x-cron-secret: <CRON_SECRET value>
//   Time:   07:30 SGT (= 23:30 UTC previous night, i.e. Sun–Thu UTC)
//   Days:   Mon–Fri SGT (= Sun–Thu UTC)
//
// Job 2 — Digest email
//   URL:    POST https://<your-render-url>/api/v1/cron/digest
//   Header: x-cron-secret: <CRON_SECRET value>
//   Time:   08:30 SGT (= 00:30 UTC)
//   Days:   Mon–Fri only

module.exports = router
```

- [ ] **Step 2: Update `server/server.js` to use extracted job functions**

Replace the inline cron callbacks so they call the shared functions:

```js
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
require('express-async-errors')

const app = require('./app')
const cron = require('node-cron')
const { runMorningNudge, runDigestEmail } = require('./src/cron/jobs')

const PORT = process.env.PORT || 8000

app.listen(PORT, async () => {
  console.log(`Tappd server running on port ${PORT}`)

  if (process.env.WEBHOOK_BASE_URL && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { bot } = require('./src/bot/telegram')
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/v1/bot/telegram`
      await bot.setWebHook(webhookUrl, { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET })
      console.log(`Telegram webhook registered: ${webhookUrl}`)
      await bot.setMyCommands([
        { command: 'start',      description: 'Register or view your profile' },
        { command: 'status',     description: "Check today's attendance" },
        { command: 'report',     description: 'Log attendance for today' },
        { command: 'deregister', description: 'Remove your profile' },
      ])
      console.log('Telegram command menu registered')
    } catch (err) {
      console.error('Webhook registration failed:', err.message)
    }
  }
})

// 7:30 AM SGT Mon–Fri = 23:30 UTC Sun–Thu
cron.schedule('30 23 * * 0-4', async () => {
  console.log('Running 7:30 AM nudge...')
  try {
    await runMorningNudge()
  } catch (err) {
    console.error('Nudge cron error:', err)
  }
})

// 8:30 AM SGT Mon–Fri = 00:30 UTC Mon–Fri
cron.schedule('30 0 * * 1-5', async () => {
  console.log('Running 8:30 AM digest + nudge...')
  try {
    await runDigestEmail()
    await runMorningNudge()
  } catch (err) {
    console.error('Digest cron error:', err)
  }
})
```

- [ ] **Step 3: Mount cron routes in `server/src/routes/index.js`**

```js
const { Router } = require('express')
const authRoutes = require('./auth.routes')
const healthRoutes = require('./health.routes')
const botRoutes = require('./bot.routes')
const officersRoutes = require('./officers.routes')
const notificationsRoutes = require('./notifications.routes')
const cronRoutes = require('./cron.routes')

const router = Router()

router.use('/auth', authRoutes)
router.use('/health', healthRoutes)
router.use('/bot', botRoutes)
router.use('/officers', officersRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/cron', cronRoutes)

module.exports = router
```

- [ ] **Step 4: Add `CRON_SECRET` to `server/.env.example`**

Append to end of file:

```
# Secret used to authenticate POST /api/v1/cron/nudge and /api/v1/cron/digest
# from cron-job.org. Generate with: openssl rand -hex 32
CRON_SECRET=
```

- [ ] **Step 5: Smoke-test the endpoints work**

Start the server locally (`npm run dev` in a separate terminal), then in another terminal:

```bash
# should return 401
curl -s -X POST http://localhost:8000/api/v1/cron/nudge | cat

# should return { ok: true } (or ok: false with an error if bot isn't configured)
CRON_SECRET_VALUE=$(grep CRON_SECRET server/.env | cut -d= -f2)
curl -s -X POST http://localhost:8000/api/v1/cron/nudge \
  -H "x-cron-secret: $CRON_SECRET_VALUE" | cat
```

Expected first call: `{"ok":false,"error":"Unauthorized"}` with status 401.
Expected second call: `{"ok":true}` or `{"ok":false,"error":"<bot error>"}`.

- [ ] **Step 6: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add server/src/routes/cron.routes.js server/src/routes/index.js server/server.js server/.env.example && git commit -m "Add HTTP cron endpoints with secret auth; keep node-cron as fallback"
```

---

## Task 4: Create settings API endpoints

**Files:**
- Create: `server/src/routes/settings.routes.js`
- Modify: `server/src/routes/index.js`

- [ ] **Step 1: Create `server/src/routes/settings.routes.js`**

```js
'use strict'

const { Router } = require('express')
const prisma = require('../config/prisma')
const authenticate = require('../middleware/authenticate')

const router = Router()
router.use(authenticate)

router.get('/scope', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { scopeDivisionId: true, scopeBranchId: true },
  })
  res.json(user)
})

router.put('/scope', async (req, res) => {
  const { scopeDivisionId, scopeBranchId } = req.body

  if (scopeDivisionId) {
    const div = await prisma.division.findUnique({ where: { id: scopeDivisionId } })
    if (!div) {
      return res.status(400).json({ error: 'Division not found' })
    }
  }
  if (scopeBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: scopeBranchId } })
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found' })
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data: {
      scopeDivisionId: scopeDivisionId || null,
      scopeBranchId: scopeBranchId || null,
    },
    select: { scopeDivisionId: true, scopeBranchId: true },
  })
  res.json(user)
})

router.get('/digest-emails', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { digestEmails: true },
  })
  res.json(user)
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.put('/digest-emails', async (req, res) => {
  const { digestEmails } = req.body
  if (!Array.isArray(digestEmails)) {
    return res.status(400).json({ error: 'digestEmails must be an array' })
  }
  const invalid = digestEmails.filter(e => typeof e !== 'string' || !EMAIL_RE.test(e))
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid email(s): ${invalid.join(', ')}` })
  }

  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data: { digestEmails },
    select: { digestEmails: true },
  })
  res.json(user)
})

module.exports = router
```

- [ ] **Step 2: Mount settings routes in `server/src/routes/index.js`**

```js
const { Router } = require('express')
const authRoutes = require('./auth.routes')
const healthRoutes = require('./health.routes')
const botRoutes = require('./bot.routes')
const officersRoutes = require('./officers.routes')
const notificationsRoutes = require('./notifications.routes')
const cronRoutes = require('./cron.routes')
const settingsRoutes = require('./settings.routes')

const router = Router()

router.use('/auth', authRoutes)
router.use('/health', healthRoutes)
router.use('/bot', botRoutes)
router.use('/officers', officersRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/cron', cronRoutes)
router.use('/settings', settingsRoutes)

module.exports = router
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add server/src/routes/settings.routes.js server/src/routes/index.js && git commit -m "Add settings endpoints: scope and digest-emails"
```

---

## Task 5: Add Settings SPA route to app.js

**Files:**
- Modify: `server/app.js`

- [ ] **Step 1: Add `/settings` to spaRoutes**

In `server/app.js`, change the `spaRoutes` line from:

```js
const spaRoutes = ['/', '/login', '/register', '/dashboard', '/attendance']
```

to:

```js
const spaRoutes = ['/', '/login', '/register', '/dashboard', '/attendance', '/settings']
```

- [ ] **Step 2: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add server/app.js && git commit -m "Add /settings to Express SPA route list"
```

---

## Task 6: Create client settings API module

**Files:**
- Create: `client/src/api/settings.api.js`

- [ ] **Step 1: Create `client/src/api/settings.api.js`**

```js
import axiosClient from './axiosClient'
import { unwrapResponse } from '../lib/http'

export const fetchScope = () =>
  axiosClient.get('/settings/scope').then(unwrapResponse)

export const updateScope = (data) =>
  axiosClient.put('/settings/scope', data).then(unwrapResponse)

export const fetchDigestEmails = () =>
  axiosClient.get('/settings/digest-emails').then(unwrapResponse)

export const updateDigestEmails = (digestEmails) =>
  axiosClient.put('/settings/digest-emails', { digestEmails }).then(unwrapResponse)
```

- [ ] **Step 2: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add client/src/api/settings.api.js && git commit -m "Add settings API client module"
```

---

## Task 7: Create Settings page

**Files:**
- Create: `client/src/pages/Settings.jsx`

- [ ] **Step 1: Create `client/src/pages/Settings.jsx`**

```jsx
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X } from '@phosphor-icons/react'
import { fetchOfficerFormOptions } from '../api/officers.api'
import { fetchScope, updateScope, fetchDigestEmails, updateDigestEmails } from '../api/settings.api'

const COLORS = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  soft: 'rgba(0,0,0,0.03)',
  line: 'rgba(0, 0, 0, 0.06)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#111111',
}

const CONTROL_CLASS =
  'w-full rounded-xl border px-3 py-2.5 text-sm transition-colors duration-150 focus:outline-none'

export default function Settings() {
  const navigate = useNavigate()
  const [divisions, setDivisions] = useState([])
  const [branches, setBranches] = useState([])
  const [scopeDivisionId, setScopeDivisionId] = useState('')
  const [scopeBranchId, setScopeBranchId] = useState('')
  const [digestEmails, setDigestEmails] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [emailInputError, setEmailInputError] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  useEffect(() => {
    fetchOfficerFormOptions().then(opts => {
      setDivisions(opts.divisions || [])
      setBranches(opts.branches || [])
    }).catch(() => {})

    fetchScope().then(data => {
      setScopeDivisionId(data.scopeDivisionId || '')
      setScopeBranchId(data.scopeBranchId || '')
    }).catch(() => {})

    fetchDigestEmails().then(data => {
      setDigestEmails(data.digestEmails || [])
    }).catch(() => {})
  }, [])

  const handleDivisionChange = async (e) => {
    const divisionId = e.target.value
    setScopeDivisionId(divisionId)
    setScopeBranchId('')
    try {
      await updateScope({ scopeDivisionId: divisionId || null, scopeBranchId: null })
      showToast('Department scope saved')
    } catch {
      showToast('Failed to save scope')
    }
  }

  const handleBranchChange = async (e) => {
    const branchId = e.target.value
    setScopeBranchId(branchId)
    try {
      await updateScope({ scopeDivisionId: scopeDivisionId || null, scopeBranchId: branchId || null })
      showToast('Department scope saved')
    } catch {
      showToast('Failed to save scope')
    }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleAddEmail = async () => {
    const email = emailInput.trim()
    if (!EMAIL_RE.test(email)) {
      setEmailInputError('Enter a valid email address')
      return
    }
    if (digestEmails.includes(email)) {
      setEmailInputError('Already in the list')
      return
    }
    setEmailInputError('')
    const next = [...digestEmails, email]
    setDigestEmails(next)
    setEmailInput('')
    try {
      await updateDigestEmails(next)
      showToast('Digest emails saved')
    } catch {
      showToast('Failed to save emails')
    }
  }

  const handleRemoveEmail = async (email) => {
    const next = digestEmails.filter(e => e !== email)
    setDigestEmails(next)
    try {
      await updateDigestEmails(next)
      showToast('Digest emails saved')
    } catch {
      showToast('Failed to save emails')
    }
  }

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: COLORS.bg, color: COLORS.text }}>
      <div className="mx-auto max-w-[640px] px-4 py-6">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center rounded-full p-2 transition-colors duration-150"
            style={{ background: COLORS.soft, color: COLORS.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.soft }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-[1.4rem] font-semibold leading-none tracking-[-0.04em]">Settings</div>
          </div>
        </div>

        {/* Section: Department Scope */}
        <section
          className="mb-6 rounded-2xl p-5"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
            Department Scope
          </div>
          <div className="mt-1 text-base font-semibold tracking-[-0.03em]">Filter digest by division</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: COLORS.muted }}>
                Division
              </label>
              <select
                value={scopeDivisionId}
                onChange={handleDivisionChange}
                className={CONTROL_CLASS}
                style={{ borderColor: COLORS.line, background: COLORS.bg, color: COLORS.text }}
              >
                <option value="">All divisions</option>
                {divisions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: COLORS.muted }}>
                Branch
              </label>
              <select
                value={scopeBranchId}
                onChange={handleBranchChange}
                disabled={!scopeDivisionId}
                className={CONTROL_CLASS}
                style={{
                  borderColor: COLORS.line,
                  background: COLORS.bg,
                  color: COLORS.text,
                  opacity: scopeDivisionId ? 1 : 0.5,
                  cursor: scopeDivisionId ? 'default' : 'not-allowed',
                }}
              >
                <option value="">All branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5" style={{ color: COLORS.muted }}>
            The daily digest email will only include officers from the selected division/branch.
            Leave blank to include all officers.
          </p>
        </section>

        {/* Section: Digest Emails */}
        <section
          className="rounded-2xl p-5"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
            Digest Emails
          </div>
          <div className="mt-1 text-base font-semibold tracking-[-0.03em]">Daily report recipients</div>

          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailInputError('') }}
                onKeyDown={handleEmailKeyDown}
                placeholder="email@example.com"
                className={CONTROL_CLASS}
                style={{
                  borderColor: emailInputError ? '#dc2626' : COLORS.line,
                  background: COLORS.bg,
                  color: COLORS.text,
                  flex: 1,
                }}
              />
              <button
                onClick={handleAddEmail}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150"
                style={{ background: COLORS.brand, color: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333' }}
                onMouseLeave={e => { e.currentTarget.style.background = COLORS.brand }}
              >
                <Plus size={15} weight="bold" />
                Add
              </button>
            </div>
            {emailInputError && (
              <p className="mt-1.5 text-xs" style={{ color: '#dc2626' }}>{emailInputError}</p>
            )}
          </div>

          {digestEmails.length > 0 && (
            <ul className="mt-4 space-y-2">
              {digestEmails.map(email => (
                <li
                  key={email}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: COLORS.soft, border: `1px solid ${COLORS.line}` }}
                >
                  <span className="text-sm">{email}</span>
                  <button
                    onClick={() => handleRemoveEmail(email)}
                    className="rounded-full p-1 transition-colors duration-150"
                    style={{ color: COLORS.muted }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.color = COLORS.muted }}
                  >
                    <X size={14} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs leading-5" style={{ color: COLORS.muted }}>
            If no emails are added, the digest is sent to your account email.
          </p>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-4 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: COLORS.brand, color: '#fff', zIndex: 50 }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add client/src/pages/Settings.jsx && git commit -m "Add Settings page with scope and digest-emails sections"
```

---

## Task 8: Wire up routing and navigation

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add `/settings` route in `client/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Roster from './pages/Roster'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/attendance" element={<Roster />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Add Settings gear link in `client/src/pages/Dashboard.jsx`**

2a. Add `GearSix` to the phosphor import at the top of Dashboard.jsx:

```jsx
import {
  Bell,
  CalendarBlank,
  Checks,
  GearSix,
  SignOut,
  UserCircle,
  Users,
  X,
} from '@phosphor-icons/react'
```

2b. In the **desktop sidebar**, add a Settings link between the nav items and the user card. Locate the `<nav className="space-y-1">` block and add after its closing `</nav>`:

```jsx
          <button
            onClick={() => navigate('/settings')}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200"
            style={{ color: COLORS.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <GearSix size={18} weight="regular" />
            <span className="text-sm font-medium tracking-[-0.02em]">Settings</span>
          </button>
```

2c. In the **mobile FAB panel**, add a Settings button before the Sign out button. Locate the FAB panel `<MotionDiv>` and insert before the existing Sign out `<button>`:

```jsx
              <button
                onClick={() => navigate('/settings')}
                className="mt-3 inline-flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors duration-200"
                style={{ background: COLORS.soft, color: 'rgba(0,0,0,0.72)' }}
              >
                <GearSix size={15} weight="regular" />
                <span>Settings</span>
              </button>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fathir/Documents/yappd && git add client/src/App.jsx client/src/pages/Dashboard.jsx && git commit -m "Wire /settings route and add gear nav link in Dashboard"
```

---

## Task 9: Lint, build, and verify

- [ ] **Step 1: Run full server test suite**

```bash
cd /Users/fathir/Documents/yappd/server && npm test --no-coverage 2>&1 | tail -20
```

Expected: all tests pass. If any pre-existing tests fail, investigate — do not skip.

- [ ] **Step 2: Run client lint**

```bash
cd /Users/fathir/Documents/yappd/client && npm run lint 2>&1 | tail -20
```

Expected: no errors. Fix any lint errors before continuing.

- [ ] **Step 3: Run client build**

```bash
cd /Users/fathir/Documents/yappd/client && npm run build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 4: Create feature branch and merge commit**

```bash
cd /Users/fathir/Documents/yappd
git checkout -b fix/cron-reliability-and-email-scoping
git log --oneline -10
```

Confirm all task commits appear. Then push:

```bash
git push -u origin fix/cron-reliability-and-email-scoping
```

---

## Post-implementation checklist

- [ ] Set `CRON_SECRET` in Render environment variables (generate with `openssl rand -hex 32`)
- [ ] Create two jobs on cron-job.org pointing at your Render URL (see comment block in `cron.routes.js`)
- [ ] For each admin user, open `/settings` and configure their Division/Branch scope and digest email list
- [ ] Trigger a manual `POST /api/v1/cron/digest` with the correct secret to verify the scoped email sends correctly before relying on the schedule
