const prisma = require('../config/prisma')

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  // Handle SG numbers: +65XXXXXXXX, 65XXXXXXXX, or XXXXXXXX
  if (digits.length >= 10 && digits.startsWith('65')) return digits.slice(2)
  if (digits.length === 8) return digits
  return digits
}

const getOfficers = async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const where = { adminId: req.user.sub }
  if (req.query.division) where.division = req.query.division
  if (req.query.branch) where.branch = req.query.branch
  const officers = await prisma.officer.findMany({
    where,
    include: { availability: { where: { date: today }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  res.json(officers)
}

const addOfficer = async (req, res) => {
  const { phoneNumber, name, rank, role, division, branch } = req.body
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' })
  const normalized = normalizePhone(phoneNumber)
  const officer = await prisma.officer.create({
    data: {
      phoneNumber: normalized,
      name: name || null,
      rank: rank || null,
      role: role || 'OFFICER',
      division: division || null,
      branch: branch || null,
      adminId: req.user.sub,
    },
  })
  res.status(201).json(officer)
}

const updateOfficer = async (req, res) => {
  const existing = await prisma.officer.findFirst({
    where: { id: req.params.id, adminId: req.user.sub },
  })
  if (!existing) return res.status(404).json({ error: 'Officer not found' })

  const data = {}
  if (req.body.name !== undefined) data.name = req.body.name
  if (req.body.rank !== undefined) data.rank = req.body.rank
  if (req.body.role !== undefined) data.role = req.body.role
  if (req.body.division !== undefined) data.division = req.body.division
  if (req.body.branch !== undefined) data.branch = req.body.branch
  if (req.body.phoneNumber !== undefined) {
    data.phoneNumber = normalizePhone(req.body.phoneNumber)
    // Phone changed — force re-verification
    data.telegramId = null
    data.telegramName = null
  }

  const updated = await prisma.officer.update({
    where: { id: req.params.id },
    data,
  })
  res.json(updated)
}

const deleteOfficer = async (req, res) => {
  const existing = await prisma.officer.findFirst({
    where: { id: req.params.id, adminId: req.user.sub },
  })
  if (!existing) return res.status(404).json({ error: 'Officer not found' })
  await prisma.officer.delete({ where: { id: req.params.id } })
  res.sendStatus(204)
}

const getRoster = async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date()
  date.setHours(0, 0, 0, 0)
  const where = { adminId: req.user.sub }
  if (req.query.division) where.division = req.query.division
  if (req.query.branch) where.branch = req.query.branch
  const officers = await prisma.officer.findMany({
    where,
    include: { availability: { where: { date }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  res.json(officers)
}

module.exports = { getOfficers, addOfficer, updateOfficer, deleteOfficer, getRoster, normalizePhone }
