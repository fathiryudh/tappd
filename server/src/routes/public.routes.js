const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

router.get('/roster', async (req, res) => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

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
    const displayName = esc([officer.rank, officer.name].filter(Boolean).join(' ') || officer.telegramName || `ID ${officer.telegramId}`)

    let statusText
    let statusColor
    let rowBg

    if (!avail) {
      countUnconfirmed++
      statusText = 'Unconfirmed'
      statusColor = '#ca8a04'
      rowBg = '#fefce8'
    } else if (avail.status === 'IN') {
      countIn++
      statusText = 'In'
      statusColor = '#16a34a'
      rowBg = '#f0fdf4'
    } else {
      countOut++
      statusText = avail.reason ? `Out — ${esc(avail.reason)}` : 'Out'
      statusColor = '#dc2626'
      rowBg = '#fafafa'
    }

    return `
      <tr style="background:${rowBg}">
        <td style="padding:10px 12px;font-weight:500">${displayName}</td>
        <td style="padding:10px 12px;color:${statusColor};font-weight:600">${statusText}</td>
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

module.exports = router
