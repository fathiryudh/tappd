// Demo seed data for local development.
// Run from `server/`: node scripts/seed-demo.js

require('dotenv').config()
const prisma = require('../src/config/prisma')

// ── Dates ─────────────────────────────────────────────────────────────────────

function utc(iso) {
  const d = new Date(iso)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

const MON = utc('2026-04-13')
const TUE = utc('2026-04-14')
const WED = utc('2026-04-15')  // today
const THU = utc('2026-04-16')
const FRI = utc('2026-04-17')

// ── Availability helpers ──────────────────────────────────────────────────────

const IN         = (date) => ({ date, status: 'IN',  reason: null,          notes: null })
const OUT        = (date, reason) => ({ date, status: 'OUT', reason,         notes: null })
const SPLIT_IN   = (date, pmReason) => ({ date, status: 'IN',  reason: pmReason, notes: `AM in, PM out (${pmReason})` })
const SPLIT_OUT  = (date, amReason) => ({ date, status: 'OUT', reason: amReason, notes: `AM out (${amReason}), PM in` })

// ── Officers + their availability ─────────────────────────────────────────────

const OFFICERS = [

  // 1 — OVL all week
  {
    telegramId: 'demo_001',
    phoneNumber: '80000001',
    name: 'ME4 Ahmad Rashid bin Zahari',
    availability: [
      OUT(MON, 'OVL'), OUT(TUE, 'OVL'), OUT(WED, 'OVL'), OUT(THU, 'OVL'), OUT(FRI, 'OVL'),
    ],
  },

  // 2 — Full week planned, mostly IN with a split today
  {
    telegramId: 'demo_002',
    phoneNumber: '80000002',
    name: 'ME3 Tan Kah Yew',
    availability: [
      IN(MON), IN(TUE), SPLIT_IN(WED, 'WFH'), IN(THU), IN(FRI),
    ],
  },

  // 3 — Today only, split (AM in PM VL)
  {
    telegramId: 'demo_003',
    phoneNumber: '80000003',
    name: 'CPT Lim Wei Jie',
    availability: [
      SPLIT_IN(WED, 'VL'),
    ],
  },

  // 4 — Today only, MC (cannot pre-plan)
  {
    telegramId: 'demo_004',
    phoneNumber: '80000004',
    name: 'LTA Siti Aminah bte Halim',
    availability: [
      OUT(WED, 'MC'),
    ],
  },

  // 5 — Today only, MC
  {
    telegramId: 'demo_005',
    phoneNumber: '80000005',
    name: 'ME2 Haziq bin Ismail',
    availability: [
      OUT(WED, 'MC'),
    ],
  },

  // 6 — Today only, IN (quick report)
  {
    telegramId: 'demo_006',
    phoneNumber: '80000006',
    name: 'SE2 Brandon Koh Jia Wei',
    availability: [
      IN(WED),
    ],
  },

  // 7 — Today only, split (AM in PM OIL)
  {
    telegramId: 'demo_007',
    phoneNumber: '80000007',
    name: 'WO Lee Choon Seng',
    availability: [
      SPLIT_IN(WED, 'OIL'),
    ],
  },

  // 8 — Full week, with splits on Tue and Wed
  {
    telegramId: 'demo_008',
    phoneNumber: '80000008',
    name: 'SE4 Rajendran s/o Kumar',
    availability: [
      IN(MON), SPLIT_IN(TUE, 'Course'), SPLIT_IN(WED, 'VL'), IN(THU), IN(FRI),
    ],
  },

  // 9 — Full week, split today
  {
    telegramId: 'demo_009',
    phoneNumber: '80000009',
    name: 'ME3 Ng Boon Kiat',
    availability: [
      IN(MON), IN(TUE), SPLIT_IN(WED, 'OIL'), IN(THU), IN(FRI),
    ],
  },

  // 10 — Full week, splits Mon and Wed
  {
    telegramId: 'demo_010',
    phoneNumber: '80000010',
    name: 'CPT Priya d/o Devi',
    availability: [
      SPLIT_IN(MON, 'Appointment'), IN(TUE), SPLIT_IN(WED, 'WFH'), IN(THU), IN(FRI),
    ],
  },

  // 11 — Full week, split today and Mon
  {
    telegramId: 'demo_011',
    phoneNumber: '80000011',
    name: 'SE3 Derrick Ong Wee Kiat',
    availability: [
      IN(MON), IN(TUE), SPLIT_IN(WED, 'VL'), IN(THU), IN(FRI),
    ],
  },

  // 12 — Full week, splits on Mon and Wed
  {
    telegramId: 'demo_012',
    phoneNumber: '80000012',
    name: 'ME4 Zainal Abidin bin Mohd Noor',
    availability: [
      SPLIT_IN(MON, 'WFH'), IN(TUE), SPLIT_IN(WED, 'OIL'), IN(THU), IN(FRI),
    ],
  },

  // 13 — Today only, AM out MC PM in (morning sick, came back afternoon)
  {
    telegramId: 'demo_013',
    phoneNumber: '80000013',
    name: 'LTA Chen Yi Ling',
    availability: [
      SPLIT_OUT(WED, 'MC'),
    ],
  },

  // 14 — Full week, split today, VL Thu
  {
    telegramId: 'demo_014',
    phoneNumber: '80000014',
    name: 'ME2 Faridah bte Yusof',
    availability: [
      IN(MON), IN(TUE), SPLIT_IN(WED, 'Course'), OUT(THU, 'VL'), IN(FRI),
    ],
  },

  // 15 — Full week, splits Mon and Wed
  {
    telegramId: 'demo_015',
    phoneNumber: '80000015',
    name: 'ME3 Nurul Ain bte Hassan',
    availability: [
      SPLIT_IN(MON, 'VL'), IN(TUE), SPLIT_IN(WED, 'WFH'), IN(THU), IN(FRI),
    ],
  },
]

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding demo officers...')
  let created = 0, updated = 0, avail = 0

  for (const o of OFFICERS) {
    const existing = await prisma.officer.findUnique({ where: { telegramId: o.telegramId } })

    if (existing) {
      await prisma.officer.update({
        where: { telegramId: o.telegramId },
        data: { name: o.name, telegramName: o.name, phoneNumber: o.phoneNumber },
      })
      updated++
    } else {
      await prisma.officer.create({
        data: { telegramId: o.telegramId, telegramName: o.name, name: o.name, phoneNumber: o.phoneNumber },
      })
      created++
    }

    const officer = await prisma.officer.findUnique({ where: { telegramId: o.telegramId } })

    for (const a of o.availability) {
      await prisma.availability.upsert({
        where: { officerId_date: { officerId: officer.id, date: a.date } },
        update: { status: a.status, reason: a.reason, notes: a.notes, rawMessage: 'seed' },
        create: { officerId: officer.id, date: a.date, status: a.status, reason: a.reason, notes: a.notes, rawMessage: 'seed' },
      })
      avail++
    }
  }

  console.log(`Done — ${created} created, ${updated} updated, ${avail} availability records`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
