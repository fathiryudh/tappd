const path = require('path')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const { PrismaClient } = require('@prisma/client')

const dbPath = path.join(__dirname, '../../prisma/yappd.db')
const dbUrl = `file:${dbPath}`

const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

module.exports = prisma
