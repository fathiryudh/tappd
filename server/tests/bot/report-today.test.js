'use strict'

const { makeMsg, makeCallback, setupMocks } = require('./helpers')

const USER_ID = 100

describe('Report Today flows', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  // ── Happy paths ──────────────────────────────────────────────────────────────

  describe('Happy paths', () => {
    test('Report Today → opens status keyboard with "Today\'s status?"', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))

      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const [chatId, text] = bot.sendMessage.mock.calls[0]
      expect(text).toBe("Today's status?")
      expect(chatId).toBe(100)
    })

    test('Report Today → IN → upserts IN for today, no "which date" in any editMessageText call', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('IN')
      expect(upsertArg.update.status).toBe('IN')

      // editMessageText should be called for confirmation, not "which date"
      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      const [confirmText] = bot.editMessageText.mock.calls[0]
      expect(confirmText).not.toMatch(/which date/i)
      expect(confirmText).toMatch(/done/i)
    })

    test('Report Today → OUT → MC → upserts OUT/MC for today, no "which date"', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('MC')
      expect(upsertArg.update.reason).toBe('MC')

      // None of the editMessageText calls should mention "which date"
      const allEditTexts = bot.editMessageText.mock.calls.map(c => c[0])
      for (const t of allEditTexts) {
        expect(t).not.toMatch(/which date/i)
      }

      // Final confirmation text
      const lastEdit = allEditTexts[allEditTexts.length - 1]
      expect(lastEdit).toMatch(/done/i)
    })

    test('Report Today → OUT → VL → upserts OUT/VL for today', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:VL'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('VL')
    })

    test('Report Today → OUT → OTHER → type "sick" → upserts OUT/sick today, no "which date"', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'reason:OTHER'))

      // Now type the reason as a message
      await handleMessage(makeMsg(USER_ID, 'sick'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.status).toBe('OUT')
      expect(upsertArg.create.reason).toBe('sick')

      // sendMessage for confirm (no messageId in this branch) — should not mention "which date"
      // The REASON_TEXT + reportToday path calls storeAndConfirm with messageId=null → sendMessage
      const allSendTexts = bot.sendMessage.mock.calls.map(c => c[1])
      for (const t of allSendTexts.slice(1)) { // skip the first "Today's status?" message
        expect(t).not.toMatch(/which date/i)
      }
    })

    test('Report Today → SPLIT → am:IN → splitreason:MC → upserts with notes containing "AM in"', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:SPLIT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'am:IN'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'splitreason:MC'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.notes).toMatch(/AM in/i)
    })

    test('Report Today → SPLIT → am:OUT → splitreason:VL → upserts with notes containing "AM out"', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:SPLIT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'am:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'splitreason:VL'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const upsertArg = prisma.availability.upsert.mock.calls[0][0]
      expect(upsertArg.create.notes).toMatch(/AM out/i)
    })
  })

  // ── Cancel flows ─────────────────────────────────────────────────────────────

  describe('Cancel flows', () => {
    test('Report Today → cancel → no upsert, editMessageText "Cancelled."', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'cancel'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      expect(bot.editMessageText.mock.calls[0][0]).toBe('Cancelled.')
    })

    test('Report Today → OUT → cancel → no upsert', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'cancel'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const lastEditText = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1][0]
      expect(lastEditText).toBe('Cancelled.')
    })
  })

  // ── Stale keyboard (Bug 1 fix) ────────────────────────────────────────────────

  describe('Stale keyboard', () => {
    test('Report Today twice → editMessageReplyMarkup called on first message to clear it', async () => {
      // First Report Today
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      // Second Report Today — should clear first keyboard
      await handleMessage(makeMsg(USER_ID, 'Report Today'))

      expect(bot.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
      const [markup, opts] = bot.editMessageReplyMarkup.mock.calls[0]
      expect(markup).toEqual({ inline_keyboard: [] })
      expect(opts.message_id).toBe(firstMid)
    })

    test('Report Today twice → tap status:IN on old msgId → editMessageText "This keyboard has expired."', async () => {
      // First Report Today
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      // Second Report Today
      await handleMessage(makeMsg(USER_ID, 'Report Today'))

      // Tap on old message — should be expired
      await handleCallbackQuery(makeCallback(USER_ID, firstMid, 'status:IN'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      const editCalls = bot.editMessageText.mock.calls
      const expiredCall = editCalls.find(c => c[0] === 'This keyboard has expired.')
      expect(expiredCall).toBeDefined()
    })

    test('Report Today twice → old expired, new msgId still works → upsert called once', async () => {
      // First Report Today
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const firstMid = (await bot.sendMessage.mock.results[0].value).message_id

      // Second Report Today
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const secondMid = (await bot.sendMessage.mock.results[1].value).message_id

      // Tap old msgId — expired
      await handleCallbackQuery(makeCallback(USER_ID, firstMid, 'status:IN'))
      // Tap new msgId — should work
      await handleCallbackQuery(makeCallback(USER_ID, secondMid, 'status:IN'))

      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    })

    test('No session + tap reason:MC → "This keyboard has expired.", no upsert', async () => {
      // No session exists at all
      await handleCallbackQuery(makeCallback(USER_ID, 99, 'reason:MC'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      expect(bot.editMessageText.mock.calls[0][0]).toBe('This keyboard has expired.')
    })

    test('Complete flow → tap old button again → "This keyboard has expired.", no double upsert', async () => {
      await handleMessage(makeMsg(USER_ID, 'Report Today'))
      const mid = (await bot.sendMessage.mock.results[0].value).message_id

      // Complete the flow
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))
      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)

      // Tap the same button again (session is now gone)
      await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))

      // Still only one upsert
      expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
      const editCalls = bot.editMessageText.mock.calls
      const expiredCall = editCalls.find(c => c[0] === 'This keyboard has expired.')
      expect(expiredCall).toBeDefined()
    })
  })

  // ── Unregistered user ─────────────────────────────────────────────────────────

  describe('Unregistered user', () => {
    test('Report Today when findUnique returns null → sends verification prompt, no upsert', async () => {
      // Override findUnique to return null for this test
      prisma.officer.findUnique.mockResolvedValue(null)

      await handleMessage(makeMsg(USER_ID, 'Report Today'))

      expect(prisma.availability.upsert).not.toHaveBeenCalled()
      expect(bot.sendMessage).toHaveBeenCalledTimes(1)
      const sentText = bot.sendMessage.mock.calls[0][1]
      expect(sentText).toMatch(/verify|phone/i)
    })
  })
})
