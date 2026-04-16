const { execFileSync } = require('child_process')
const path = require('path')
const { Client } = require('pg')

const connectionString = process.env.DATABASE_URL
const sqliteDbPath = process.argv[2] || path.join(__dirname, '..', 'prisma', 'yappd.db')

if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

function loadSqliteRows(dbPath, tableName) {
  const sql = `select * from "${tableName}";`
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
  }).trim()

  return output ? JSON.parse(output) : []
}

function toBool(value) {
  if (value === null || value === undefined) return value
  return Boolean(value)
}

async function main() {
  const data = {
    User: loadSqliteRows(sqliteDbPath, 'User'),
    Division: loadSqliteRows(sqliteDbPath, 'Division'),
    Branch: loadSqliteRows(sqliteDbPath, 'Branch'),
    Officer: loadSqliteRows(sqliteDbPath, 'Officer'),
    Availability: loadSqliteRows(sqliteDbPath, 'Availability'),
    NotificationEvent: loadSqliteRows(sqliteDbPath, 'NotificationEvent'),
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query('begin')

    await client.query('delete from public."NotificationEvent"')
    await client.query('delete from public."Availability"')
    await client.query('delete from public."Officer"')
    await client.query('delete from public."Division"')
    await client.query('delete from public."Branch"')
    await client.query('delete from public."User"')
    await client.query('delete from public."Task"')

    for (const row of data.User) {
      await client.query(
        `insert into public."User" ("id", "email", "passwordHash", "refreshToken", "createdAt", "updatedAt")
         values ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.email, row.passwordHash, row.refreshToken, row.createdAt, row.updatedAt]
      )
    }

    for (const row of data.Division) {
      await client.query(
        `insert into public."Division" ("id", "name")
         values ($1, $2)`,
        [row.id, row.name]
      )
    }

    for (const row of data.Branch) {
      await client.query(
        `insert into public."Branch" ("id", "name")
         values ($1, $2)`,
        [row.id, row.name]
      )
    }

    for (const row of data.Officer) {
      await client.query(
        `insert into public."Officer" (
          "id", "telegramId", "telegramName", "phoneNumber", "name", "rank", "role",
          "divisionId", "branchId", "adminId", "createdAt", "updatedAt"
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          row.id,
          row.telegramId,
          row.telegramName,
          row.phoneNumber,
          row.name,
          row.rank,
          row.role,
          row.divisionId,
          row.branchId,
          row.adminId,
          row.createdAt,
          row.updatedAt,
        ]
      )
    }

    for (const row of data.Availability) {
      await client.query(
        `insert into public."Availability" (
          "id", "officerId", "date", "status", "reason", "rawMessage", "notes", "splitDay", "createdAt"
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          row.id,
          row.officerId,
          row.date,
          row.status,
          row.reason,
          row.rawMessage,
          row.notes,
          toBool(row.splitDay),
          row.createdAt,
        ]
      )
    }

    for (const row of data.NotificationEvent) {
      await client.query(
        `insert into public."NotificationEvent" (
          "id", "adminId", "officerId", "title", "message", "eventDate", "readAt", "createdAt"
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.id,
          row.adminId,
          row.officerId,
          row.title,
          row.message,
          row.eventDate,
          row.readAt,
          row.createdAt,
        ]
      )
    }

    await client.query('commit')

    console.log(
      JSON.stringify(
        Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length])),
        null,
        2
      )
    )
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
