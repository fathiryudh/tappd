'use strict'
const path = require('path')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const { PrismaClient } = require('@prisma/client')

const dbPath = path.join(__dirname, './yappd.db')
const dbUrl = `file:${dbPath}`
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

const DIVISIONS = [
  '1st Div',
  '2nd Div',
  '3rd Div',
  '4th Div',
  'Marine Division',
  'SCDF HQ',
]

async function main() {
  for (const name of DIVISIONS) {
    await prisma.division.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    console.log(`Seeded: ${name}`)
  }
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
