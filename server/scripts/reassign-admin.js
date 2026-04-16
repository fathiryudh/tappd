require('dotenv').config()
const prisma = require('../src/config/prisma')

const USAGE = 'Usage: node scripts/reassign-admin.js <fromAdminId> <toAdminId>'

async function main() {
  const [fromAdminId, toAdminId] = process.argv.slice(2)

  if (!fromAdminId || !toAdminId) {
    throw new Error(USAGE)
  }

  if (fromAdminId === toAdminId) {
    throw new Error('Source and destination admin IDs must be different.')
  }

  const [fromAdmin, toAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromAdminId }, select: { id: true, email: true } }),
    prisma.user.findUnique({ where: { id: toAdminId }, select: { id: true, email: true } }),
  ])

  if (!fromAdmin) {
    throw new Error(`Source admin not found: ${fromAdminId}`)
  }

  if (!toAdmin) {
    throw new Error(`Destination admin not found: ${toAdminId}`)
  }

  const [officerResult, notificationResult] = await prisma.$transaction([
    prisma.officer.updateMany({
      where: { adminId: fromAdminId },
      data: { adminId: toAdminId },
    }),
    prisma.notificationEvent.updateMany({
      where: { adminId: fromAdminId },
      data: { adminId: toAdminId },
    }),
  ])

  console.log(
    JSON.stringify(
      {
        fromAdmin,
        toAdmin,
        officersReassigned: officerResult.count,
        notificationsReassigned: notificationResult.count,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
