// CLI helper to create or update an officer record directly in the database.
// Usage:
// node scripts/add-officer.js <phoneNumber> <name> <rank> <adminEmail> [divisionName] [branchName] [telegramId]

require('dotenv').config()
const prisma = require('../src/config/prisma')
const {
  normalizePhone,
  buildDivisionRelationInput,
  buildBranchRelationInput,
} = require('../src/controllers/officers.controller')

const USAGE =
  'Usage: node scripts/add-officer.js <phoneNumber> <name> <rank> <adminEmail> [divisionName] [branchName] [telegramId]'

async function main() {
  const [phoneNumber, name, rank, adminEmail, division, branch, telegramId] = process.argv.slice(2)

  if (!phoneNumber || !adminEmail) {
    throw new Error(USAGE)
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    throw new Error(`No user found with email: ${adminEmail}`)
  }

  const normalizedPhone = normalizePhone(phoneNumber)
  const divisionInput = await buildDivisionRelationInput({ division }, 'create')
  const branchInput = await buildBranchRelationInput({ branch }, 'create')

  const officer = await prisma.officer.upsert({
    where: { phoneNumber: normalizedPhone },
    update: {
      telegramId: telegramId ? String(telegramId) : null,
      name: name || null,
      rank: rank || null,
      admin: { connect: { id: admin.id } },
      ...divisionInput,
      ...branchInput,
    },
    create: {
      phoneNumber: normalizedPhone,
      telegramId: telegramId ? String(telegramId) : null,
      name: name || null,
      rank: rank || null,
      admin: { connect: { id: admin.id } },
      ...divisionInput,
      ...branchInput,
    },
  })

  console.log('Officer added:', officer)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
