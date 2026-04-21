'use strict'

let prisma, transporter, sendDailyDigest

beforeAll(() => {
  jest.resetModules()

  const mockTransporter = {
    sendMail: jest.fn().mockResolvedValue({}),
  }

  jest.doMock('../../src/config/prisma', () => ({
    officer: {
      findMany: jest.fn(),
    },
  }))
  jest.doMock('../../src/utils/mailer', () => ({
    transporter: mockTransporter,
  }))

  prisma = require('../../src/config/prisma')
  transporter = mockTransporter
  const digestModule = require('../../src/bot/digest')
  sendDailyDigest = digestModule.sendDailyDigest
})

beforeEach(() => jest.clearAllMocks())

describe('sendDailyDigest', () => {
  const mockOfficers = [
    { id: '1', name: 'Alice', telegramName: null, telegramId: null, availability: [] },
    { id: '2', name: 'Bob',   telegramName: null, telegramId: null,
      availability: [{ status: 'IN', reason: null }] },
  ]

  test('sends to all recipients in array', async () => {
    prisma.officer.findMany.mockResolvedValue(mockOfficers)

    await sendDailyDigest(['a@example.com', 'b@example.com'])

    expect(transporter.sendMail).toHaveBeenCalledTimes(1)
    const call = transporter.sendMail.mock.calls[0][0]
    expect(call.to).toBe('a@example.com, b@example.com')
  })

  test('passes officerWhere to prisma findMany', async () => {
    prisma.officer.findMany.mockResolvedValue(mockOfficers)

    await sendDailyDigest(['a@example.com'], { divisionId: 'div-1' })

    expect(prisma.officer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { divisionId: 'div-1' },
      })
    )
  })

  test('skips send when recipients array is empty', async () => {
    await sendDailyDigest([])
    expect(transporter.sendMail).not.toHaveBeenCalled()
    expect(prisma.officer.findMany).not.toHaveBeenCalled()
  })

  test('skips send when officers list is empty', async () => {
    prisma.officer.findMany.mockResolvedValue([])
    await sendDailyDigest(['a@example.com'])
    expect(transporter.sendMail).not.toHaveBeenCalled()
  })
})
