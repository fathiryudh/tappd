// One-time script to add an officer directly to the DB
// Usage: node scripts/add-officer.js <telegramId> <name> <rank> <adminEmail>

require('dotenv').config()
const prisma = require('../src/config/prisma')

async function main() {
  const [telegramId, name, rank, adminEmail] = process.argv.slice(2)

  if (!telegramId || !adminEmail) {
    console.error('Usage: node scripts/add-officer.js <telegramId> <name> <rank> <adminEmail>')
    process.exit(1)
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    console.error(`No user found with email: ${adminEmail}`)
    process.exit(1)
  }

  const officer = await prisma.officer.upsert({
    where: { telegramId: String(telegramId) },
    update: { name, rank, adminId: admin.id },
    create: { telegramId: String(telegramId), name, rank, adminId: admin.id },
  })

  console.log('Officer added:', officer)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
