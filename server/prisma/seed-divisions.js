'use strict'
require('dotenv').config()
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
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
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
