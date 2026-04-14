require('dotenv').config({ override: true })
require('express-async-errors')

const app = require('./app')
const cron = require('node-cron')
const { sendDailyDigest, getUnreportedOfficers } = require('./src/bot/digest')

const PORT = process.env.PORT || 8000

app.listen(PORT, async () => {
  console.log(`Yappd server running on port ${PORT}`)

  // Register Telegram webhook on startup (only if public URL is configured)
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

// 7:30 AM SGT Mon–Fri = 23:30 UTC Sun–Thu — first nudge for unreported officers
cron.schedule('30 23 * * 0-4', async () => {
  console.log('Running 7:30 AM nudge...')
  try {
    const { nudgeOfficers } = require('./src/bot/telegram')
    const unreported = await getUnreportedOfficers()
    await nudgeOfficers(unreported)
  } catch (err) {
    console.error('Nudge cron error:', err)
  }
})

// 8:30 AM SGT Mon–Fri = 00:30 UTC Mon–Fri — digest + second nudge for still-unreported
cron.schedule('30 0 * * 1-5', async () => {
  console.log('Running 8:30 AM digest + nudge...')
  try {
    const { nudgeOfficers } = require('./src/bot/telegram')
    await sendDailyDigest(process.env.DIGEST_EMAIL)
    const unreported = await getUnreportedOfficers()
    await nudgeOfficers(unreported)
  } catch (err) {
    console.error('Digest cron error:', err)
  }
})
