const prisma = require('../config/prisma')
const { transporter } = require('../utils/mailer')

const STATUS_EMOJI = {
  AVAILABLE:    '✅',
  UNAVAILABLE:  '❌',
  MC:           '🏥',
  ON_LEAVE:     '🏖️',
  DUTY:         '🎖️',
  UNKNOWN:      '❓',
  NOT_REPORTED: '⚠️',
}

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

  if (officers.length === 0) return // no officers yet, skip

  const lines = officers.map(o => {
    const avail = o.availability[0]
    const status = avail ? avail.status : 'NOT_REPORTED'
    const emoji = STATUS_EMOJI[status] || '⚠️'
    const display = o.name || o.telegramName || o.telegramId
    const note = avail?.notes ? ` (${avail.notes})` : ''
    return { text: `${emoji} ${display} — ${status}${note}`, status }
  })

  const available = lines.filter(l => l.status === 'AVAILABLE').length
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
    ...lines.map(l => l.text),
    ``,
    `Summary: ${available}/${officers.length} available`,
  ].join('\n')

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b">
      <h2 style="margin-bottom:4px">Daily Availability Report</h2>
      <p style="color:#71717a;margin-top:0">${dateStr}</p>
      <p><strong style="font-size:18px">${available}/${officers.length}</strong> <span style="color:#71717a">available today</span></p>
      <ul style="padding:0;list-style:none;margin:0">
        ${lines.map(l => `<li style="padding:6px 0;border-bottom:1px solid #f4f4f5">${l.text}</li>`).join('')}
      </ul>
      <p style="color:#a1a1aa;font-size:12px;margin-top:16px">Sent by Yappd</p>
    </div>
  `

  await transporter.sendMail({
    from: `Yappd <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `Yappd Daily Roster — ${dateStr} (${available}/${officers.length} available)`,
    text: textBody,
    html: htmlBody,
  })

  console.log(`Digest sent to ${adminEmail}: ${available}/${officers.length} available`)
}

module.exports = { sendDailyDigest }
