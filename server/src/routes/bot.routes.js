const router = require('express').Router()
const { handleMessage, handleCommand } = require('../bot/telegram')

router.post('/telegram', (req, res) => {
  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(403)

  const update = req.body
  res.sendStatus(200) // respond to Telegram immediately

  if (update.message) {
    const text = update.message.text || ''
    if (text.startsWith('/')) {
      handleCommand(update.message).catch(console.error)
    } else {
      handleMessage(update.message).catch(console.error)
    }
  }
})

module.exports = router
