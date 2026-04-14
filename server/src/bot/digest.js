const prisma = require('../config/prisma')
const { transporter } = require('../utils/mailer')

async function sendDailyDigest(adminId, adminEmail) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const officers = await prisma.officer.findMany({
    where: { adminId },
    include: {
      availability: { where: { date: today }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })

  if (officers.length === 0) return

  const rows = officers.map(o => {
    const avail = o.availability[0]
    const displayName = o.name || o.telegramName || o.telegramId
    if (!avail) {
      return { label: '[?]', displayName, reasonStr: 'Unconfirmed', status: 'unconfirmed' }
    }
    if (avail.status === 'IN') {
      return { label: '[IN]', displayName, reasonStr: '', status: 'in' }
    }
    return { label: '[OUT]', displayName, reasonStr: avail.reason || '', status: 'out' }
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
    `Yappd Daily Availability Report`,
    `${dateStr}`,
    ``,
    ...rows.map(r => r.reasonStr ? `${r.label} ${r.displayName} — ${r.reasonStr}` : `${r.label} ${r.displayName}`),
    ``,
    `${countIn} in · ${countOut} out · ${countUnconfirmed} unconfirmed`,
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
            <td style="padding:6px 8px;border-bottom:1px solid #f4f4f5">${r.reasonStr ? `${r.displayName} — ${r.reasonStr}` : r.displayName}</td>
          </tr>`).join('')}
      </table>
      <p style="color:#71717a;font-size:13px;margin-top:12px">${countIn} in · ${countOut} out · ${countUnconfirmed} unconfirmed</p>
      <p style="color:#a1a1aa;font-size:12px;margin-top:16px">Sent by Yappd</p>
    </div>
  `

  await transporter.sendMail({
    from: `Yappd <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `Yappd Daily Roster — ${dateStr} (${countIn}/${officers.length} in)`,
    text: textBody,
    html: htmlBody,
  })

  console.log(`Digest sent to ${adminEmail}: ${countIn}/${officers.length} in`)
}

async function getUnreportedOfficers(adminId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return prisma.officer.findMany({
    where: {
      adminId,
      availability: { none: { date: today } },
    },
  })
}

module.exports = { sendDailyDigest, getUnreportedOfficers }
