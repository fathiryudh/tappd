/**
 * One-off script: send a test digest email to a specific address.
 * Usage: node scripts/test-digest.js scxooper@gmail.com
 */
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const { sendDailyDigest } = require('../src/bot/digest')
const prisma = require('../src/config/prisma')

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node scripts/test-digest.js <email>')
    process.exit(1)
  }

  console.log(`Sending digest to: ${email}`)
  await sendDailyDigest([email])
  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
