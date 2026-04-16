const prisma = require('../config/prisma')
const { normalizePhone } = require('../utils/phone')
const {
  OFFICER_FORM_OPTION_SELECT,
  OFFICER_ROLES,
  buildOfficerInclude,
  serializeFormOptions,
  serializeOfficer,
  serializeOfficerCollection,
} = require('../../../shared/contracts/api')

async function buildDivisionRelationInput({ divisionId, division }, mode = 'create') {
  if (divisionId !== undefined) {
    if (!divisionId) return mode === 'update' ? { division: { disconnect: true } } : {}
    return { division: { connect: { id: divisionId } } }
  }

  if (division === undefined) return {}
  const name = typeof division === 'string' ? division.trim() : ''
  if (!name) return mode === 'update' ? { division: { disconnect: true } } : {}

  return {
    division: {
      connectOrCreate: {
        where: { name },
        create: { name },
      },
    },
  }
}

async function buildBranchRelationInput({ branchId, branch }, mode = 'create') {
  if (branchId !== undefined) {
    if (!branchId) return mode === 'update' ? { branch: { disconnect: true } } : {}
    return { branch: { connect: { id: branchId } } }
  }

  if (branch === undefined) return {}
  const name = typeof branch === 'string' ? branch.trim() : ''
  if (!name) return mode === 'update' ? { branch: { disconnect: true } } : {}

  return {
    branch: {
      connectOrCreate: {
        where: { name },
        create: { name },
      },
    },
  }
}

async function buildOfficerWhere(adminId, query = {}) {
  const where = { adminId }

  if (query.divisionId) {
    where.divisionId = query.divisionId
  } else if (query.division) {
    where.division = { is: { name: query.division } }
  }

  if (query.branchId) {
    where.branchId = query.branchId
  } else if (query.branch) {
    where.branch = { is: { name: query.branch } }
  }

  return where
}

const getOfficers = async (req, res) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const where = await buildOfficerWhere(req.user.sub, req.query)
  const officers = await prisma.officer.findMany({
    where,
    include: buildOfficerInclude({ date: today }),
    orderBy: { name: 'asc' },
  })
  res.json(serializeOfficerCollection(officers))
}

const addOfficer = async (req, res) => {
  const { phoneNumber, name, rank, role } = req.body
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' })
  const normalized = normalizePhone(phoneNumber)
  const divisionInput = await buildDivisionRelationInput(req.body, 'create')
  const branchInput = await buildBranchRelationInput(req.body, 'create')
  const officer = await prisma.officer.create({
    data: {
      phoneNumber: normalized,
      name: name || null,
      rank: rank || null,
      role: role || OFFICER_ROLES.OFFICER,
      admin: { connect: { id: req.user.sub } },
      ...divisionInput,
      ...branchInput,
    },
    include: buildOfficerInclude(),
  })
  res.status(201).json(serializeOfficer(officer))
}

const getOfficerFormOptions = async (req, res) => {
  const divisions = await prisma.division.findMany({
    orderBy: { name: 'asc' },
    select: OFFICER_FORM_OPTION_SELECT,
  })

  res.json(serializeFormOptions({ divisions }))
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
  if (req.body.phoneNumber !== undefined) {
    data.phoneNumber = normalizePhone(req.body.phoneNumber)
    // Phone changed — force re-verification
    data.telegramId = null
    data.telegramName = null
  }
  Object.assign(data, await buildDivisionRelationInput(req.body, 'update'))
  Object.assign(data, await buildBranchRelationInput(req.body, 'update'))

  const updated = await prisma.officer.update({
    where: { id: req.params.id },
    data,
    include: buildOfficerInclude(),
  })
  res.json(serializeOfficer(updated))
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
  const where = await buildOfficerWhere(req.user.sub, req.query)
  const officers = await prisma.officer.findMany({
    where,
    include: buildOfficerInclude({ date }),
    orderBy: { name: 'asc' },
  })
  res.json(serializeOfficerCollection(officers))
}

module.exports = {
  getOfficers,
  addOfficer,
  getOfficerFormOptions,
  updateOfficer,
  deleteOfficer,
  getRoster,
  normalizePhone,
  buildDivisionRelationInput,
  buildBranchRelationInput,
  buildOfficerWhere,
}
