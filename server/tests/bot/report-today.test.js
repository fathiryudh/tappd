'use strict'

const { makeMsg, makeCallback, setupMocks } = require('./helpers')

const USER_ID = 100

// Pin date to a known weekday so weekend guards don't fire during tests
beforeAll(() => jest.useFakeTimers({ now: new Date('2026-04-14T08:00:00') }))
afterAll(() => jest.useRealTimers())

describe('Report Today flows', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  describe('Happy paths', () => {
    test('Report Today → opens status keyboard with "Choose today status."', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))

      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const [chatId, text] = bot.sendMessage.mock.calls[0]
      expect(text).toBe('Choose today status.')
      expect(chatId).toBe(100)
    })

    test('Report Today → IN → upserts IN for today, no "which date" in any editMessageText call', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('IN')
      expect(upsertArg.update.status).toBe('IN')

      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      const [confirmText] = bot.editMessageText.mock.calls[0]
      expect(confirmText).not.toMatch(/which date/i)
      expect(confirmText).toMatch(/saved/i)
    })

    test('Report Today → OUT → MC → upserts OUT/MC for today, no "which date"', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('MC')
      expect(upsertArg.update.reason).toBe('MC')

      const allEditTexts = bot.editMessageText.mock.calls.map(c => c[0])
      for (const t of allEditTexts) {
        expect(t).not.toMatch(/which date/i)
      }

      const lastEdit = allEditTexts[allEditTexts.length - 1]
      expect(lastEdit).toMatch(/saved/i)
    })

    test('Report Today → OUT → VL → upserts OUT/VL for today', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:VL'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('VL')
    })

    test('Report Today → OUT → OTHER → type "sick" → upserts OUT/sick today, no "which date"', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:OTHER'))

      await handleMessage(makeMsg(USER_ID, 'sick'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('SICK')

      const allSendTexts = bot.sendMessage.mock.calls.map(c => c[1])
      for (const t of allSendTexts.slice(1)) {
        expect(t).not.toMatch(/which date/i)
      }
    })

    test('Report Today → SPLIT → AM in → PM out with reason → stores requested split format', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:SPLIT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'am:IN'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'pm:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'pmreason:MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.notes).toBe('AM IN / PM OUT(MC)')
    })

    test('Report Today → SPLIT → different AM and PM out reasons are stored separately', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:SPLIT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'am:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'amreason:VL'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'pm:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'pmreason:MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.notes).toBe('AM OUT(VL) / PM OUT(MC)')
      expect(upsertArg.create.reason).toBe('VL')
    })
  })
  describe('Cancel flows', () => {
    test('Report Today → cancel → no upsert, editMessageText "Cancelled."', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'cancel'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      expect(bot.editMessageText.mock.calls[0][0]).toBe('Cancelled.')
    })

    test('Report Today → OUT → cancel → no upsert', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'cancel'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const lastEditText = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1][0]
      expect(lastEditText).toBe('Cancelled.')
    })
  })

  describe('Stale keyboard', () => {
    test('Report Today twice → editMessageReplyMarkup called on first message to clear it', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))

      expect(bot.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
      const [markup, opts] = bot.editMessageReplyMarkup.mock.calls[0]
      expect(markup).toEqual({ inline_keyboard: [] })
      expect(opts.message_id).toBe(firstMid)
    })

    test('Report Today twice → tap status:IN on old msgId → editMessageText "This keyboard has expired."', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))

      await handleCallbackQuery(makeCallback(USER_ID, firstMid, 'status:IN'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const editCalls = bot.editMessageText.mock.calls
      const expiredCall = editCalls.find(c => c[0] === 'This keyboard has expired.')
      expect(expiredCall).toBeDefined()
    })

    test('Report Today twice → old expired, new msgId still works → upsert called once', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const secondMid = (await bot.sendMessage.mock.results[1].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, firstMid, 'status:IN'))
      await handleCallbackQuery(makeCallback(USER_ID, secondMid, 'status:IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    })

    test('No session + tap reason:MC → "This keyboard has expired.", no upsert', async () => {
      await handleCallbackQuery(makeCallback(USER_ID, 99, 'reason:MC'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      expect(bot.editMessageText.mock.calls[0][0]).toBe('This keyboard has expired.')
    })

    test('Complete flow → tap old button again → "This keyboard has expired.", no double upsert', async () => {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))
      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const editCalls = bot.editMessageText.mock.calls
      const expiredCall = editCalls.find(c => c[0] === 'This keyboard has expired.')
      expect(expiredCall).toBeDefined()
    })
  })

  describe('Unregistered user', () => {
    test('Report Today when findUnique returns null → sends verification prompt, no upsert', async () => {
      prisma.officer.findUnique.mockResolvedValue(null)

      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/verify|phone/i)
    })
  })
})
