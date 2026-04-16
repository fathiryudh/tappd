'use strict'

const { makeMsg, makeCallback, setupMocks } = require('./helpers')

const USER_ID = 100

describe('Week grid flows', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  async function openGrid(text = '📅 Plan This Week') {
    await handleMessage(makeMsg(USER_ID, text))
    const mid = (await bot.sendMessage.mock.results[0].value).message_id
    const gridKeyboard = bot.sendMessage.mock.calls[0][2].reply_markup.inline_keyboard
    const firstDayBtn = gridKeyboard[0][0]
    const firstDayDate = firstDayBtn.callback_data.replace('week_day:', '')
    return { mid, gridKeyboard, firstDayDate }
  }

  test('Plan This Week → sendMessage with date range text and week_day buttons', async () => {
    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text, opts] = bot.sendMessage.mock.calls[0]
    expect(chatId).toBe(100)

    expect(text).toMatch(/\d+ \w+ \d{4}/)
    expect(text).toMatch(/Choose a day/i)

    const allButtons = opts.reply_markup.inline_keyboard.flat()
    const dayButtons = allButtons.filter(b => b.callback_data.startsWith('week_day:'))
    expect(dayButtons.length).toBeGreaterThanOrEqual(1)
  })

  test('Plan Next Week → sendMessage called with inline keyboard', async () => {
    await handleMessage(makeMsg(USER_ID, '📅 Plan Next Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [, , opts] = bot.sendMessage.mock.calls[0]
    const allButtons = opts.reply_markup.inline_keyboard.flat()
    const dayButtons = allButtons.filter(b => b.callback_data.startsWith('week_day:'))
    expect(dayButtons.length).toBeGreaterThanOrEqual(1)
  })

  test('Open grid → tap first day → week_status:IN → editMessageText called (grid refresh), no upsert', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:IN'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalled()
  })

  test('Open grid → tap day → week_status:OUT → week_reason:MC → editMessageText called, no upsert', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_reason:MC'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalled()
  })

  test('Open grid → tap day → SPLIT → AM in → PM out → PM reason → editMessageText called', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:SPLIT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_am:IN'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_pm:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_split_pm_reason:VL'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalled()

    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  test('Open grid → tap day → week_back → editMessageText called (back to grid)', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))

    const editsBefore = bot.editMessageText.mock.calls.length

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_back'))

    expect(bot.editMessageText.mock.calls.length).toBeGreaterThan(editsBefore)

    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  test('Open grid → week_all_in → upsert called for all days IN, editMessageText with confirm', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_all_in'))

    expect(prisma.availability.upsert).toHaveBeenCalled()

    for (const call of prisma.availability.upsert.mock.calls) {
      expect(call[0].create.status).toBe('IN')
    }

    expect(bot.editMessageText).toHaveBeenCalled()
    const confirmText = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1][0]
    expect(confirmText).toMatch(/saved/i)
  })

  test('Mark one day IN → week_confirm → upsert called once with status IN', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:IN'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_confirm'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = prisma.availability.upsert.mock.calls[0][0]
    expect(upsertArg.create.status).toBe('IN')

    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/saved/i)
  })

  test('Open grid → week_confirm with nothing set → no upsert, answerCallbackQuery with alert text', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_confirm'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()

    const alertCall = bot.answerCallbackQuery.mock.calls.find(
      c => c[1] && c[1].text && c[1].text.match(/select a day/i)
    )
    expect(alertCall).toBeDefined()
  })

  test('Open grid → week_cancel → no upsert, editMessageText "Cancelled."', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_cancel'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    const cancelCall = bot.editMessageText.mock.calls.find(c => c[0] === 'Cancelled.')
    expect(cancelCall).toBeDefined()
  })

  test('week_status:IN with no grid open → editMessageText "This keyboard has expired."', async () => {
    await handleCallbackQuery(makeCallback(USER_ID, 99, 'week_status:IN'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    const expiredCall = bot.editMessageText.mock.calls.find(
      c => c[0] === 'This keyboard has expired.'
    )
    expect(expiredCall).toBeDefined()
  })

  test('Open grid → tap day → week_status:OUT → week_reason:OTHER → type reason → editMessageText (grid refresh)', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_reason:OTHER'))

    const typeReasonCall = bot.editMessageText.mock.calls.find(c => c[0] === 'Type reason.')
    expect(typeReasonCall).toBeDefined()

    const editsBefore = bot.editMessageText.mock.calls.length

    await handleMessage(makeMsg(USER_ID, 'overseas trip'))

    expect(bot.editMessageText.mock.calls.length).toBeGreaterThan(editsBefore)

    const newEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(newEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  test('Open grid → split day with different AM and PM reasons → confirm stores both reasons', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:SPLIT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_am:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_split_am_reason:MC'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_pm:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_split_pm_reason:Course'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_confirm'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = prisma.availability.upsert.mock.calls[0][0]
    expect(upsertArg.create.notes).toBe('AM OUT(MC) / PM OUT(Course)')
  })

  test('NSF officer → "Plan This Week" → sendMessage text matches /NSF/i', async () => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks({ role: 'NSF' }))

    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const sentText = bot.sendMessage.mock.calls[0][1]
    expect(sentText).toMatch(/NSF/i)
  })

  test('Unregistered officer → "Plan This Week" → sends verification prompt', async () => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)

    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const sentText = bot.sendMessage.mock.calls[0][1]
    expect(sentText).toMatch(/verify|phone/i)
  })
})
