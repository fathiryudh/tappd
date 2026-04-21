'use strict'

const prisma = require('../config/prisma')
const { sendDailyDigest, getUnreportedOfficers } = require('../bot/digest')
const { nudgeOfficers } = require('../bot/telegram')

async function runMorningNudge() {
  const unreported = await getUnreportedOfficers()
  await nudgeOfficers(unreported)
  console.log(`Morning nudge: sent to ${unreported.length} officer(s)`)
}

async function runDigestEmail() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    const recipients = user.digestEmails.length > 0 ? user.digestEmails : [user.email]
    const officerWhere = {}
    if (user.scopeDivisionId) officerWhere.divisionId = user.scopeDivisionId
    if (user.scopeBranchId) officerWhere.branchId = user.scopeBranchId
    await sendDailyDigest(recipients, officerWhere)
  }
}

module.exports = { runMorningNudge, runDigestEmail }
