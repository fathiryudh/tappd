'use strict'

const { makeMsg, makeGroupMsg, setupMocks } = require('./helpers')

const USER_ID = 100

// Pin date to a known weekday so weekend guards don't fire during tests
beforeAll(() => jest.useFakeTimers({ now: new Date('2026-04-14T08:00:00') }))
afterAll(() => jest.useRealTimers())

function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

describe('Keyword shortcut flows', () => {
  let bot, prisma, handleMessage

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage } } = setupMocks())
  })

  describe('IN keywords', () => {
    test('"in" → upserts status: IN for today', async () => {
      await handleMessage(makeMsg(USER_ID, 'in'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'IN', date: expect.any(Date) }),
        })
      )
    })

    test('"In" (mixed case) → upserts status: IN for today', async () => {
      await handleMessage(makeMsg(USER_ID, 'In'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'IN', date: expect.any(Date) }),
        })
      )
    })

    test('"IN" (uppercase) → upserts status: IN for today', async () => {
      await handleMessage(makeMsg(USER_ID, 'IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'IN', date: expect.any(Date) }),
        })
      )
    })

    test('"in" → date stored matches today', async () => {
      const todayISO = localISODate()

      await handleMessage(makeMsg(USER_ID, 'in'))

      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      const storedDate = upsertArg.create.date
      expect(storedDate).toBeInstanceOf(Date)
      expect(storedDate.toISOString().startsWith(todayISO)).toBe(true)
    })
  })
  describe('OUT keywords', () => {
    test('"mc" → upserts OUT/MC', async () => {
      await handleMessage(makeMsg(USER_ID, 'mc'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'MC', date: expect.any(Date) }),
        })
      )
    })

    test('"MC" (uppercase) → upserts OUT/MC', async () => {
      await handleMessage(makeMsg(USER_ID, 'MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'MC', date: expect.any(Date) }),
        })
      )
    })

    test('"vl" → upserts OUT/VL', async () => {
      await handleMessage(makeMsg(USER_ID, 'vl'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'VL', date: expect.any(Date) }),
        })
      )
    })

    test('"ovl" → upserts OUT/OVL', async () => {
      await handleMessage(makeMsg(USER_ID, 'ovl'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'OVL', date: expect.any(Date) }),
        })
      )
    })

    test('"oil" → upserts OUT/OIL', async () => {
      await handleMessage(makeMsg(USER_ID, 'oil'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'OIL', date: expect.any(Date) }),
        })
      )
    })

    test('"wfh" → upserts OUT/WFH', async () => {
      await handleMessage(makeMsg(USER_ID, 'wfh'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'WFH', date: expect.any(Date) }),
        })
      )
    })

    test('"course" → upserts OUT/Course', async () => {
      await handleMessage(makeMsg(USER_ID, 'course'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'OUT', reason: 'Course', date: expect.any(Date) }),
        })
      )
    })

    test('keyword sends a sendMessage confirmation (no messageId — uses sendMessage not editMessageText)', async () => {
      await handleMessage(makeMsg(USER_ID, 'mc'))
      expect(bot.sendMessage).toHaveBeenCalled()
      expect(bot.editMessageText).not.toHaveBeenCalled()
    })
  })

  describe('Unrecognised text', () => {
    test('"hello" → no upsert, sendMessage with "Choose today status."', async () => {
      await handleMessage(makeMsg(USER_ID, 'hello'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toBe('Choose today status.')
    })

    test('"random text" → no upsert, falls through to status keyboard', async () => {
      await handleMessage(makeMsg(USER_ID, 'random text'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toBe('Choose today status.')
    })
  })
  describe('Empty text', () => {
    test('empty string "" → no upsert, no sendMessage (early return)', async () => {
      await handleMessage(makeMsg(USER_ID, ''))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).not.toHaveBeenCalled()
    })

    test('whitespace-only string → no upsert, no sendMessage (sanitizeInput trims to empty)', async () => {
      await handleMessage(makeMsg(USER_ID, '   '))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).not.toHaveBeenCalled()
    })
  })
  describe('Unregistered user', () => {
    test('"mc" from unregistered user → no upsert, sendMessage matches /verify|phone/i', async () => {
      prisma.officer.findUnique.mockResolvedValue(null)

      await handleMessage(makeMsg(USER_ID, 'mc'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/verify|phone/i)
    })

    test('"in" from unregistered user → no upsert, prompts verification', async () => {
      prisma.officer.findUnique.mockResolvedValue(null)

      await handleMessage(makeMsg(USER_ID, 'in'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/verify|phone/i)
    })
  })
  describe('NSF officer', () => {
    beforeEach(() => {
      ;({ bot, prisma, handlers: { handleMessage } } = setupMocks({ role: 'NSF' }))
    })

    test('"mc" from NSF officer → no upsert, sendMessage text matches /NSF/i', async () => {
      await handleMessage(makeMsg(USER_ID, 'mc'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/NSF/i)
    })

    test('"in" from NSF officer → no upsert, bot responds with NSF message', async () => {
      await handleMessage(makeMsg(USER_ID, 'in'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/NSF/i)
    })
  })
  describe('Group chat guard', () => {
    test('"mc" in group chat → no upsert (private chat guard)', async () => {
      await handleMessage(makeGroupMsg(USER_ID, 'mc'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
    })

    test('"in" in group chat → no upsert', async () => {
      await handleMessage(makeGroupMsg(USER_ID, 'in'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
    })

    test('group chat message → bot.sendMessage called with private-only notice', async () => {
      await handleMessage(makeGroupMsg(USER_ID, 'mc'))
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/private/i)
    })
  })
})
