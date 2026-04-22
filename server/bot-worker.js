const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
require('express-async-errors')

const { bot, handleMessage, handleCommand, handleCallbackQuery } = require('./src/bot/telegram')
const cron = require('node-cron')
const { runMorningNudge, runDigestEmail } = require('./src/cron/jobs')

const rateLimits = new Map()
const RATE_LIMIT = 20
const RATE_WINDOW = 60000

function isRateLimited(telegramId) {
  const now = Date.now()
  const entry = rateLimits.get(telegramId)
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimits.set(telegramId, { windowStart: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_WINDOW) rateLimits.delete(id)
  }
}, 300000)

async function start() {
  await bot.deleteWebHook()
  bot.startPolling({ interval: 1000, autoStart: true })
  await bot.setMyCommands([
    { command: 'start',       description: 'Register or view your profile' },
    { command: 'report',      description: 'Log attendance for today' },
    { command: 'status',      description: "Check today's attendance status" },
    { command: 'holiday',     description: 'Mark yourself OVL for a date range' },
    { command: 'roster',      description: "View today's attendance roster" },
    { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
    { command: 'deregister',  description: 'Remove your profile and attendance history' },
  ])
  console.log('Bot worker started (long polling)')

  bot.on('message', (msg) => {
    if (!msg.from) return
    const id = String(msg.from.id)
    if (isRateLimited(id)) { console.warn(`[RATE LIMIT] telegramId=${id}`); return }
    if (msg.contact) { handleMessage(msg).catch(console.error); return }
    const text = msg.text || ''
    text.startsWith('/')
      ? handleCommand(msg).catch(console.error)
      : handleMessage(msg).catch(console.error)
  })

  bot.on('callback_query', (query) => {
    const id = String(query.from.id)
    if (isRateLimited(id)) { console.warn(`[RATE LIMIT] telegramId=${id}`); return }
    handleCallbackQuery(query).catch(console.error)
  })
}

start().catch(err => { console.error('Bot worker failed to start:', err); process.exit(1) })

// 7:30 AM SGT Mon–Fri = 23:30 UTC Sun–Thu
cron.schedule('30 23 * * 0-4', () => runMorningNudge().catch(console.error))

// 8:30 AM SGT Mon–Fri = 00:30 UTC Mon–Fri
cron.schedule('30 0 * * 1-5', () => {
  runDigestEmail().catch(console.error)
  runMorningNudge().catch(console.error)
})
