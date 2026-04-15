const router = require('express').Router()
const { handleMessage, handleCommand, handleCallbackQuery } = require('../bot/telegram')

// ── Rate limiter: 20 messages/minute per telegramId ──────────────────────────
const rateLimits = new Map()
const RATE_LIMIT = 20
const RATE_WINDOW = 60000 // 1 minute

function isRateLimited(telegramId) {
  const now = Date.now()
  const entry = rateLimits.get(telegramId)
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimits.set(telegramId, { windowStart: now, count: 1 })
    return false
  }
  entry.count++
  if (entry.count > RATE_LIMIT) return true
  return false
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_WINDOW) rateLimits.delete(id)
  }
}, 300000)

router.post('/telegram', (req, res) => {
  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(403)

  const update = req.body
  res.sendStatus(200)

  // Extract telegramId for rate limiting
  const telegramId = String(
    update.callback_query?.from?.id ||
    update.message?.from?.id ||
    0
  )

  if (telegramId !== '0' && isRateLimited(telegramId)) {
    console.warn(`[RATE LIMIT] telegramId=${telegramId}`)
    return
  }

  if (update.callback_query) {
    handleCallbackQuery(update.callback_query).catch(console.error)
    return
  }

  if (update.message) {
    // Handle contact messages (phone verification)
    if (update.message.contact) {
      handleMessage(update.message).catch(console.error)
      return
    }

    const text = update.message.text || ''
    if (text.startsWith('/')) {
      handleCommand(update.message).catch(console.error)
    } else {
      handleMessage(update.message).catch(console.error)
    }
  }
})

module.exports = router
