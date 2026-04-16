const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { buildWorkWeek, getMondayOfWeek, localISODate, toUTCStartOfDay } = require('../utils/date')

const STATUS_STYLE = {
  unconfirmed: { text: 'Unconfirmed', color: '#ca8a04', rowBg: '#fefce8' },
  split: { color: '#7c3aed', rowBg: '#faf5ff' },
  in: { text: 'IN', color: '#16a34a', rowBg: '#f0fdf4' },
  out: { color: '#dc2626', rowBg: '#fafafa' },
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseSplitHalf(notes, period) {
  const modern = notes.match(new RegExp(`${period}\\s+(IN|OUT(?:\\(([^)]+)\\))?)`, 'i'))
  if (modern) {
    const token = modern[1].toUpperCase()
    return {
      in: token.startsWith('IN'),
      reason: modern[2] || '',
    }
  }

  const legacyIn = new RegExp(`${period.toLowerCase()} in`, 'i').test(notes)
  const legacyOut = notes.match(new RegExp(`${period.toLowerCase()} out \\(([^)]+)\\)`, 'i'))
  return {
    in: legacyIn,
    reason: legacyOut ? legacyOut[1] : '',
  }
}

function getOfficerDisplayName(officer) {
  return [officer.rank, officer.name].filter(Boolean).join(' ')
    || officer.telegramName
    || `ID ${officer.telegramId}`
}

function formatOutStatus(reason) {
  const normalizedReason = reason ? reason.toUpperCase() : ''
  return normalizedReason ? `OUT(${normalizedReason})` : 'OUT'
}

function getAvailabilityPresentation(avail) {
  if (!avail) {
    return { key: 'unconfirmed', ...STATUS_STYLE.unconfirmed }
  }

  if (avail.notes && avail.notes.includes('AM')) {
    const am = parseSplitHalf(avail.notes, 'AM')
    const pm = parseSplitHalf(avail.notes, 'PM')

    return {
      key: 'split',
      text: `${am.in ? 'IN' : formatOutStatus(am.reason)}/${pm.in ? 'IN' : formatOutStatus(pm.reason)}`,
      ...STATUS_STYLE.split,
    }
  }

  if (avail.status === 'IN') {
    return { key: 'in', ...STATUS_STYLE.in }
  }

  return {
    key: 'out',
    text: formatOutStatus(avail.reason),
    ...STATUS_STYLE.out,
  }
}

function findAvailabilityByIsoDate(availability, isoDate) {
  const targetTime = toUTCStartOfDay(isoDate).getTime()
  return availability.find((entry) => new Date(entry.date).getTime() === targetTime) || null
}

router.get('/roster', async (req, res) => {
  const today = toUTCStartOfDay(localISODate())

  const officers = await prisma.officer.findMany({
    include: {
      availability: { where: { date: today }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })

  const now = new Date()
  const dateHeading = now.toLocaleDateString('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const lastUpdated = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  let countIn = 0
  let countOut = 0
  let countUnconfirmed = 0

  const rows = officers.map((officer) => {
    const avail = officer.availability[0]
    const displayName = esc(getOfficerDisplayName(officer))
    const status = getAvailabilityPresentation(avail)

    if (status.key === 'unconfirmed') {
      countUnconfirmed++
    } else if (status.key === 'in') {
      countIn++
    } else {
      countOut++
    }

    return `
      <tr style="background:${status.rowBg}">
        <td style="padding:10px 12px;font-weight:500">${displayName}</td>
        <td style="padding:10px 12px;color:${status.color};font-weight:600">${status.text}</td>
      </tr>`
  }).join('')

  const total = officers.length
  const summary = `${total} officer${total !== 1 ? 's' : ''} · ${countIn} in · ${countOut} out · ${countUnconfirmed} unconfirmed`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="300">
  <title>SCDF 2 Div HQ — Roster</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #f9fafb;
      color: #111827;
      padding: 24px 16px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .date {
      font-size: 0.95rem;
      color: #6b7280;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    thead tr {
      background: #f3f4f6;
    }
    thead th {
      padding: 10px 12px;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    tbody tr:not(:last-child) td {
      border-bottom: 1px solid #e5e7eb;
    }
    td { font-size: 0.925rem; }
    .summary {
      margin-top: 16px;
      font-size: 0.85rem;
      color: #6b7280;
    }
    .footer {
      margin-top: 8px;
      font-size: 0.8rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SCDF 2 Div HQ</h1>
    <p class="date">${dateHeading}</p>
    <table>
      <thead>
        <tr>
          <th>Officer</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="2" style="padding:12px;color:#9ca3af">No officers found.</td></tr>'}
      </tbody>
    </table>
    <p class="summary">${summary}</p>
    <p class="footer">Last updated: ${lastUpdated}</p>
  </div>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(html)
})

router.get('/weekly-roster', async (req, res) => {
  const weekParam = req.query.week || localISODate()
  const monday = getMondayOfWeek(weekParam)
  const week = buildWorkWeek(monday)
  const weekDates = week.map(toUTCStartOfDay)

  const officers = await prisma.officer.findMany({
    include: {
      availability: { where: { date: { in: weekDates } } },
    },
    orderBy: { name: 'asc' },
  })

  const officerData = officers.map(officer => {
    const name = getOfficerDisplayName(officer)
    const days = {}
    for (const iso of week) {
      const avail = findAvailabilityByIsoDate(officer.availability, iso)
      days[iso] = avail
        ? { status: avail.status, reason: avail.reason || null, notes: avail.notes || '' }
        : null
    }
    return { id: officer.id, name, days }
  })

  res.setHeader('Cache-Control', 'no-store')
  res.json({
    week,
    today: localISODate(),
    officers: officerData,
  })
})

module.exports = router
