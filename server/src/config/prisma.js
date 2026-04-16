const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const host = process.env.DB_HOST
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_NAME || 'postgres'
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD

  if (!host || !user || !password) {
    throw new Error('Missing database configuration. Set DATABASE_URL or DB_HOST, DB_USER, and DB_PASSWORD.')
  }

  const params = new URLSearchParams()
  const schema = process.env.DB_SCHEMA
  const sslmode = process.env.DB_SSLMODE || 'require'

  if (schema) params.set('schema', schema)
  if (process.env.DB_USE_LIBPQ_COMPAT !== 'false') {
    params.set('uselibpqcompat', 'true')
  }
  if (sslmode) params.set('sslmode', sslmode)

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${params.toString()}`
}

const pool = new Pool({ connectionString: buildDatabaseUrl() })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

module.exports = prisma
