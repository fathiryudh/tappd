const router = require('express').Router()
const { handleMessage, handleCommand, handleCallbackQuery } = require('../bot/telegram')

const rateLimits = new Map()
const RATE_LIMIT = 20
const RATE_WINDOW = 60000 // 1 minute

function getTelegramId(update) {
  return String(
    update.callback_query?.from?.id
    ?? update.message?.from?.id
    ?? 0
  )
}

function logUpdateError(kind, telegramId, error) {
  const message = error?.message || error
  console.error(`[BOT ROUTE] ${kind} failed for telegramId=${telegramId}:`, message)
}

function runUpdateHandler(kind, telegramId, handler) {
  handler.catch(error => logUpdateError(kind, telegramId, error))
}

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

  const telegramId = getTelegramId(update)

  if (telegramId !== '0' && isRateLimited(telegramId)) {
    console.warn(`[RATE LIMIT] telegramId=${telegramId}`)
    return
  }

  if (update.callback_query) {
    runUpdateHandler('callback query', telegramId, handleCallbackQuery(update.callback_query))
    return
  }

  if (update.message) {
    if (update.message.contact) {
      runUpdateHandler('contact message', telegramId, handleMessage(update.message))
      return
    }

    const text = update.message.text || ''
    if (text.startsWith('/')) {
      runUpdateHandler('command', telegramId, handleCommand(update.message))
    } else {
      runUpdateHandler('message', telegramId, handleMessage(update.message))
    }
  }
})

module.exports = router
