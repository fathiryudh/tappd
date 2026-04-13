require('dotenv').config()
require('express-async-errors')

const app = require('./app')
const cron = require('node-cron')
const prisma = require('./src/config/prisma')
const { sendDailyDigest } = require('./src/bot/digest')

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Yappd server running on port ${PORT}`)

  // Register Telegram webhook on startup (only if public URL is configured)
  if (process.env.WEBHOOK_BASE_URL && process.env.TELEGRAM_BOT_TOKEN) {
    const { bot } = require('./src/bot/telegram')
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/v1/bot/telegram`
    bot.setWebHook(webhookUrl, { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET })
      .then(() => console.log(`Telegram webhook registered: ${webhookUrl}`))
      .catch(err => console.error('Webhook registration failed:', err.message))
  }
})

// Daily digest at 7:00 AM SGT (23:00 UTC previous day)
cron.schedule('0 23 * * *', async () => {
  console.log('Running daily digest...')
  try {
    const admins = await prisma.user.findMany({ select: { id: true, email: true } })
    for (const admin of admins) {
      try {
        await sendDailyDigest(admin.id, admin.email)
      } catch (err) {
        console.error(`Digest failed for ${admin.email}:`, err.message)
      }
    }
  } catch (err) {
    console.error('Digest cron error:', err)
  }
})
