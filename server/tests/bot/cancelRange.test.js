'use strict'

const { cancelRangeMatch } = require('../../src/bot/parser')
const { makeMsg, setupMocks } = require('./helpers')

const TODAY = '2026-04-21'
const USER_ID = 200

describe('cancelRangeMatch', () => {
  test('cancel 21/4 to 30/4 → 8 weekday dates', () => {
    const days = cancelRangeMatch('cancel 21/4 to 30/4', TODAY)
    expect(days).not.toBeNull()
    expect(days).toHaveLength(8)
    expect(days[0]).toBe('2026-04-21')
  })

  test('cancel 21 apr to 24 apr → 4 weekday dates', () => {
    const days = cancelRangeMatch('cancel 21 apr to 24 apr', TODAY)
    expect(days).not.toBeNull()
    expect(days).toHaveLength(4)
  })

  test('case insensitive: CANCEL 21/4 to 30/4', () => {
    expect(cancelRangeMatch('CANCEL 21/4 to 30/4', TODAY)).not.toBeNull()
  })

  test('end before start → null', () => {
    expect(cancelRangeMatch('cancel 30/4 to 21/4', TODAY)).toBeNull()
  })

  test('weekend-only range → null', () => {
    expect(cancelRangeMatch('cancel 25/4 to 26/4', TODAY)).toBeNull()
  })

  test('range > 60 weekdays → null', () => {
    expect(cancelRangeMatch('cancel 1/1 to 30/6', TODAY)).toBeNull()
  })

  test('no "to" keyword → null', () => {
    expect(cancelRangeMatch('cancel 21/4', TODAY)).toBeNull()
  })

  test('not a cancel message → null', () => {
    expect(cancelRangeMatch('ovl 21/4 to 30/4', TODAY)).toBeNull()
  })

  test('just "cancel" → null', () => {
    expect(cancelRangeMatch('cancel', TODAY)).toBeNull()
  })
})

describe('cancel range integration via handleMessage', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-04-21T08:00:00') })
    ;({ bot, prisma, handlers } = setupMocks())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('"cancel 21/4 to 24/4" deletes records and confirms', async () => {
    await handlers.handleMessage(makeMsg(USER_ID, 'cancel 21/4 to 24/4'))

    expect(prisma.availability.deleteMany).toHaveBeenCalledTimes(1)
    const where = prisma.availability.deleteMany.mock.calls[0][0].where
    expect(where.officerId).toBeTruthy()
    expect(where.date.in).toHaveLength(4)
    expect(bot.sendMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('Cancelled'),
      expect.any(Object)
    )
  })

  test('"cancel 21/4 to 24/4" message contains day count', async () => {
    await handlers.handleMessage(makeMsg(USER_ID, 'cancel 21/4 to 24/4'))

    const msg = bot.sendMessage.mock.calls[bot.sendMessage.mock.calls.length - 1][1]
    expect(msg).toContain('4')
  })
})
