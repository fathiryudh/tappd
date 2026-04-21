'use strict'

jest.mock('../../src/config/prisma', () => ({
  user: { findMany: jest.fn() },
}))
jest.mock('../../src/bot/digest', () => ({
  sendDailyDigest: jest.fn().mockResolvedValue(undefined),
  getUnreportedOfficers: jest.fn().mockResolvedValue([]),
}))
jest.mock('../../src/bot/telegram', () => ({
  nudgeOfficers: jest.fn().mockResolvedValue(undefined),
}))

const prisma = require('../../src/config/prisma')
const { sendDailyDigest, getUnreportedOfficers } = require('../../src/bot/digest')
const { nudgeOfficers } = require('../../src/bot/telegram')
const { runMorningNudge, runDigestEmail } = require('../../src/cron/jobs')

beforeEach(() => jest.clearAllMocks())

describe('runMorningNudge', () => {
  test('fetches unreported officers and nudges them', async () => {
    const officers = [{ id: '1', telegramId: '111' }]
    getUnreportedOfficers.mockResolvedValue(officers)

    await runMorningNudge()

    expect(getUnreportedOfficers).toHaveBeenCalledTimes(1)
    expect(nudgeOfficers).toHaveBeenCalledWith(officers)
  })
})

describe('runDigestEmail', () => {
  test('sends digest to each user using digestEmails when set', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'admin@example.com', digestEmails: ['digest@example.com'],
        scopeDivisionId: 'div-1', scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(
      ['digest@example.com'],
      { divisionId: 'div-1' }
    )
  })

  test('falls back to user.email when digestEmails is empty', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'admin@example.com', digestEmails: [],
        scopeDivisionId: null, scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(['admin@example.com'], {})
  })

  test('includes both divisionId and branchId in where when both are set', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@b.com', digestEmails: [],
        scopeDivisionId: 'div-1', scopeBranchId: 'br-1' },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledWith(
      ['a@b.com'],
      { divisionId: 'div-1', branchId: 'br-1' }
    )
  })

  test('sends digest to each user independently', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'a@a.com', digestEmails: [], scopeDivisionId: null, scopeBranchId: null },
      { id: 'u2', email: 'b@b.com', digestEmails: [], scopeDivisionId: 'div-2', scopeBranchId: null },
    ])

    await runDigestEmail()

    expect(sendDailyDigest).toHaveBeenCalledTimes(2)
    expect(sendDailyDigest).toHaveBeenNthCalledWith(1, ['a@a.com'], {})
    expect(sendDailyDigest).toHaveBeenNthCalledWith(2, ['b@b.com'], { divisionId: 'div-2' })
  })
})
