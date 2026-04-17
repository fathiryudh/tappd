'use strict'

const { makeMsg, makeCallback, setupMocks } = require('./helpers')

const USER_ID = 100

// Pin date to a known weekday so weekend guards don't fire during tests
beforeAll(() => jest.useFakeTimers({ now: new Date('2026-04-14T08:00:00') }))
afterAll(() => jest.useRealTimers())

describe('Cold callbacks — no session', () => {
  let bot, prisma, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleCallbackQuery } } = setupMocks())
  })

  const COLD_CALLBACKS = [
    'status:IN',
    'status:OUT',
    'status:SPLIT',
    'reason:MC',
    'reason:VL',
    'am:IN',
    'splitreason:MC',
    'date:today',
  ]

  for (const data of COLD_CALLBACKS) {
    test(`${data} with no session → "This keyboard has expired.", no upsert`, async () => {
      await handleCallbackQuery(makeCallback(USER_ID, 42, data))

      expect(bot.editMessageText).toHaveBeenCalledTimes(1)
      expect(bot.editMessageText.mock.calls[0][0]).toBe('This keyboard has expired.')
      expect(prisma.availability.upsert).not.toHaveBeenCalled()
    })
  }

  test('week_status:IN with no weekSession → "This keyboard has expired."', async () => {
    await handleCallbackQuery(makeCallback(USER_ID, 42, 'week_status:IN'))

    expect(bot.editMessageText).toHaveBeenCalledTimes(1)
    expect(bot.editMessageText.mock.calls[0][0]).toBe('This keyboard has expired.')
    expect(prisma.availability.upsert).not.toHaveBeenCalled()
  })
})
describe('Cancel with no session', () => {
  let bot, prisma, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleCallbackQuery } } = setupMocks())
  })

  test('cancel callback with no session → editMessageText "Cancelled.", no upsert', async () => {
    await handleCallbackQuery(makeCallback(USER_ID, 77, 'cancel'))

    expect(bot.editMessageText).toHaveBeenCalledTimes(1)
    expect(bot.editMessageText.mock.calls[0][0]).toBe('Cancelled.')
    expect(prisma.availability.upsert).not.toHaveBeenCalled()
  })
})
describe('Rapid fire', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  test('Report Today × 5 → sendMessage 5 times, editMessageReplyMarkup 4 times, last msgId upserts once', async () => {
    const msgIds = []

    for (let i = 0; i < 5; i++) {
      await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
      const result = await bot.sendMessage.mock.results[i].value
      msgIds.push(result.message_id)
    }

    expect(bot.sendMessage).toHaveBeenCalledTimes(5)
    expect(bot.editMessageReplyMarkup).toHaveBeenCalledTimes(4)

    const lastMid = msgIds[msgIds.length - 1]
    await handleCallbackQuery(makeCallback(USER_ID, lastMid, 'status:IN'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
  })

  test('Plan This Week × 3 → no crash, sendMessage called 3 times', async () => {
    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))
    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))
    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(3)
    expect(prisma.availability.upsert).not.toHaveBeenCalled()
  })
})
describe('Mixed sessions', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  test('Report Today then Plan This Week → week_cancel → "Cancelled.", no upsert', async () => {
    await handleMessage(makeMsg(USER_ID, '📋 Report Today'))

    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))
    const weekMsgId = (await bot.sendMessage.mock.results[1].value).message_id

    await handleCallbackQuery(makeCallback(USER_ID, weekMsgId, 'week_cancel'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    const allEditTexts = bot.editMessageText.mock.calls.map(c => c[0])
    expect(allEditTexts).toContain('Cancelled.')
  })
})

describe('edit_today flow', () => {
  let bot, prisma, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleCallbackQuery } } = setupMocks())
  })

  test('edit_today → editMessageReplyMarkup on original msg, sendMessage "Choose today status."', async () => {
    const origMid = 55

    await handleCallbackQuery(makeCallback(USER_ID, origMid, 'edit_today'))

    expect(bot.editMessageReplyMarkup).toHaveBeenCalledTimes(1)
    const [markup, opts] = bot.editMessageReplyMarkup.mock.calls[0]
    expect(markup).toEqual({ inline_keyboard: [] })
    expect(opts.message_id).toBe(origMid)

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [, text] = bot.sendMessage.mock.calls[0]
    expect(text).toBe('Choose today status.')
  })

  test('edit_today → status:OUT → reason:VL → upserts OUT/VL today, no "which date" in editMessageText calls', async () => {
    const origMid = 55

    await handleCallbackQuery(makeCallback(USER_ID, origMid, 'edit_today'))

    // Get the new message ID from the sendMessage call
    const newMid = (await bot.sendMessage.mock.results[0].value).message_id

    await handleCallbackQuery(makeCallback(USER_ID, newMid, 'status:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, newMid, 'reason:VL'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = prisma.availability.upsert.mock.calls[0][0]
    expect(upsertArg.create.status).toBe('OUT')
    expect(upsertArg.create.reason).toBe('VL')

    const allEditTexts = bot.editMessageText.mock.calls.map(c => c[0])
    for (const t of allEditTexts) {
      expect(t).not.toMatch(/which date/i)
    }

    const lastEdit = allEditTexts[allEditTexts.length - 1]
    expect(lastEdit).toMatch(/saved/i)
  })
})

describe('Post-completion double-tap', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  test('Complete Report Today → IN, then tap status:OUT on same msgId → "This keyboard has expired.", upsert once', async () => {
    await handleMessage(makeMsg(USER_ID, '📋 Report Today'))
    const mid = (await bot.sendMessage.mock.results[0].value).message_id

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:IN'))
    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'status:OUT'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)

    const allEditTexts = bot.editMessageText.mock.calls.map(c => c[0])
    const expiredCall = allEditTexts.find(t => t === 'This keyboard has expired.')
    expect(expiredCall).toBeDefined()
  })
})

describe('Group chat callback', () => {
  let bot, prisma, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleCallbackQuery } } = setupMocks())
  })

  test('Callback from group chat → no upsert, no editMessageText (just returns)', async () => {
    const groupCallback = {
      id: 'cbq_group_test',
      from: { id: USER_ID },
      message: {
        message_id: 42,
        chat: { id: 200, type: 'group' },
      },
      data: 'status:IN',
    }

    await handleCallbackQuery(groupCallback)

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).not.toHaveBeenCalled()
  })
})

describe('Unregistered user callback', () => {
  let bot, prisma, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleCallbackQuery } } = setupMocks())
  })

  test('findUnique returns null → tap status:IN → editMessageText matches /not registered|start/i', async () => {
    prisma.officer.findUnique.mockResolvedValue(null)

    await handleCallbackQuery(makeCallback(USER_ID, 42, 'status:IN'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalledTimes(1)
    const [text] = bot.editMessageText.mock.calls[0]
    expect(text).toMatch(/not registered|start/i)
  })
})
