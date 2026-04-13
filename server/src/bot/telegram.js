const TelegramBot = require('node-telegram-bot-api')
const prisma = require('../config/prisma')
const { parseAvailabilityMessage } = require('./parser')

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)

const STATUS_EMOJI = {
  AVAILABLE:   '✅',
  UNAVAILABLE: '❌',
  MC:          '🏥',
  ON_LEAVE:    '🏖️',
  DUTY:        '🎖️',
  UNKNOWN:     '❓',
}

async function handleMessage(msg) {
  const telegramId = String(msg.from.id)
  const rawMessage = msg.text?.trim()
  if (!rawMessage) return

  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await bot.sendMessage(
      msg.chat.id,
      "You're not registered in any unit yet. Ask your admin to add you to Yappd."
    )
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  try {
    const parsed = await parseAvailabilityMessage(rawMessage, today, tomorrow)

    await prisma.availability.upsert({
      where: {
        officerId_date: {
          officerId: officer.id,
          date: new Date(parsed.date),
        },
      },
      update: { status: parsed.status, rawMessage, notes: parsed.notes || null },
      create: {
        officerId: officer.id,
        date: new Date(parsed.date),
        status: parsed.status,
        rawMessage,
        notes: parsed.notes || null,
      },
    })

    const emoji = STATUS_EMOJI[parsed.status] || '❓'
    const displayName = officer.name || officer.telegramName || 'Officer'
    await bot.sendMessage(
      msg.chat.id,
      `${emoji} Got it, ${displayName}\\! Marked as *${parsed.status}* for ${parsed.date}.`,
      { parse_mode: 'MarkdownV2' }
    )
  } catch (err) {
    console.error('Bot parse error:', err)
    await bot.sendMessage(
      msg.chat.id,
      "Hmm, I couldn't parse that. Try: 'available', 'MC today', 'on leave', or 'duty tomorrow'."
    )
  }
}

async function handleCommand(msg) {
  const text = msg.text || ''

  if (text.startsWith('/start')) {
    await bot.sendMessage(
      msg.chat.id,
      "👋 Welcome to Yappd\\! Just send your status — e.g. 'available', 'MC today', 'on leave', or 'duty tmr'\\.",
      { parse_mode: 'MarkdownV2' }
    )
    return
  }

  if (text.startsWith('/status') || text.startsWith('/roster')) {
    const telegramId = String(msg.from.id)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const officer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { availability: { where: { date: today }, take: 1 } },
    })

    if (!officer) {
      await bot.sendMessage(msg.chat.id, "You're not registered yet.")
      return
    }

    const avail = officer.availability[0]
    const status = avail ? `${STATUS_EMOJI[avail.status] || '❓'} ${avail.status}` : '⚠️ Not reported yet'
    await bot.sendMessage(msg.chat.id, `Your status today: ${status}`)
  }
}

module.exports = { bot, handleMessage, handleCommand }
