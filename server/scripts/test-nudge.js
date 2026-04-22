/**
 * One-off script: send a test nudge to a specific Telegram username.
 * Usage: node scripts/test-nudge.js lvl1crook
 */
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const TelegramBot = require('node-telegram-bot-api')
const prisma = require('../src/config/prisma')

async function main() {
  const username = (process.argv[2] || '').replace(/^@/, '')
  if (!username) {
    console.error('Usage: node scripts/test-nudge.js <telegram_username>')
    process.exit(1)
  }

  const officer = await prisma.officer.findFirst({
    where: { telegramName: { equals: username, mode: 'insensitive' } },
  })

  if (!officer) {
    console.error(`No officer found with telegramName: ${username}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  if (!officer.telegramId) {
    console.error(`Officer ${officer.name} has no telegramId on record`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`Found officer: ${officer.name || officer.telegramName} (telegramId: ${officer.telegramId})`)

  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)
  const name = officer.name || officer.telegramName || 'there'

  await bot.sendMessage(
    officer.telegramId,
    `Morning ${name}.\nNo status logged yet for today.\nUpdate before 0830.\n\nType in, mc, vl or tap Report Today.`
  )

  console.log('Nudge sent.')
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
