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
        { command: 'start',       description: 'Register or view your profile' },
        { command: 'report',      description: 'Log attendance for today' },
        { command: 'status',      description: "Check today's attendance status" },
        { command: 'holiday',     description: 'Mark yourself OVL for a date range' },
        { command: 'roster',      description: "View today's attendance roster" },
        { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
        { command: 'deregister',  description: 'Remove your profile and attendance history' },
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
