const prisma = require('../config/prisma')

const getOfficers = async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const officers = await prisma.officer.findMany({
    where: { adminId: req.user.sub },
    include: { availability: { where: { date: today }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  res.json(officers)
}

const addOfficer = async (req, res) => {
  const { telegramId, name, rank } = req.body
  if (!telegramId) return res.status(400).json({ error: 'telegramId is required' })
  const officer = await prisma.officer.create({
    data: {
      telegramId: String(telegramId),
      name: name || null,
      rank: rank || null,
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
  const updated = await prisma.officer.update({
    where: { id: req.params.id },
    data: { name: req.body.name, rank: req.body.rank },
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
  const officers = await prisma.officer.findMany({
    where: { adminId: req.user.sub },
    include: { availability: { where: { date }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  res.json(officers)
}

module.exports = { getOfficers, addOfficer, updateOfficer, deleteOfficer, getRoster }
