'use strict'

const { Router } = require('express')
const prisma = require('../config/prisma')
const authenticate = require('../middleware/authenticate')

const router = Router()
router.use(authenticate)

router.get('/scope', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { scopeDivisionId: true, scopeBranchId: true },
  })
  res.json(user)
})

router.put('/scope', async (req, res) => {
  const { scopeDivisionId, scopeBranchId } = req.body

  if (scopeDivisionId) {
    const div = await prisma.division.findUnique({ where: { id: scopeDivisionId } })
    if (!div) {
      return res.status(400).json({ error: 'Division not found' })
    }
  }
  if (scopeBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: scopeBranchId } })
    if (!branch) {
      return res.status(400).json({ error: 'Branch not found' })
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data: {
      scopeDivisionId: scopeDivisionId || null,
      scopeBranchId: scopeBranchId || null,
    },
    select: { scopeDivisionId: true, scopeBranchId: true },
  })
  res.json(user)
})

router.get('/digest-emails', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { digestEmails: true },
  })
  res.json(user)
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.put('/digest-emails', async (req, res) => {
  const { digestEmails } = req.body
  if (!Array.isArray(digestEmails)) {
    return res.status(400).json({ error: 'digestEmails must be an array' })
  }
  const invalid = digestEmails.filter(e => typeof e !== 'string' || !EMAIL_RE.test(e))
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid email(s): ${invalid.join(', ')}` })
  }

  const user = await prisma.user.update({
    where: { id: req.user.sub },
    data: { digestEmails },
    select: { digestEmails: true },
  })
  res.json(user)
})

module.exports = router
