'use strict'

const { makeMsg, makeCallback, makeOfficer, setupMocks } = require('./helpers')

const USER_ID = 100

describe('Week grid flows', () => {
  let bot, prisma, handleMessage, handleCallbackQuery

  beforeEach(() => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks())
  })

  // ── Helper to open the grid and get grid metadata ───────────────────────────

  async function openGrid(text = '📅 Plan This Week') {
    await handleMessage(makeMsg(USER_ID, text))
    const mid = (await bot.sendMessage.mock.results[0].value).message_id
    const gridKeyboard = bot.sendMessage.mock.calls[0][2].reply_markup.inline_keyboard
    // First day button is in row 0
    const firstDayBtn = gridKeyboard[0][0]
    const firstDayDate = firstDayBtn.callback_data.replace('week_day:', '')
    return { mid, gridKeyboard, firstDayDate }
  }

  // ── 1. Open grid ─────────────────────────────────────────────────────────────

  test('Plan This Week → sendMessage with date range text and week_day buttons', async () => {
    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text, opts] = bot.sendMessage.mock.calls[0]
    expect(chatId).toBe(100)

    // Text should look like "14 Apr 2026 – 17 Apr 2026\nTap a day..."
    expect(text).toMatch(/\d+ \w+ \d{4}/)
    expect(text).toMatch(/Tap a day/)

    // Keyboard must contain week_day: buttons
    const allButtons = opts.reply_markup.inline_keyboard.flat()
    const dayButtons = allButtons.filter(b => b.callback_data.startsWith('week_day:'))
    expect(dayButtons.length).toBeGreaterThanOrEqual(1)
  })

  // ── 2. Open next week ────────────────────────────────────────────────────────

  test('Plan Next Week → sendMessage called with inline keyboard', async () => {
    await handleMessage(makeMsg(USER_ID, '📅 Plan Next Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const [, , opts] = bot.sendMessage.mock.calls[0]
    const allButtons = opts.reply_markup.inline_keyboard.flat()
    const dayButtons = allButtons.filter(b => b.callback_data.startsWith('week_day:'))
    expect(dayButtons.length).toBeGreaterThanOrEqual(1)
  })

  // ── 3. Mark day IN ───────────────────────────────────────────────────────────

  test('Open grid → tap first day → week_status:IN → editMessageText called (grid refresh), no upsert', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:IN'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    // editMessageText called at least once for the grid refresh
    expect(bot.editMessageText).toHaveBeenCalled()
  })

  // ── 4. Mark day OUT + MC ─────────────────────────────────────────────────────

  test('Open grid → tap day → week_status:OUT → week_reason:MC → editMessageText called, no upsert', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_reason:MC'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalled()
  })

  // ── 5. Mark day SPLIT ────────────────────────────────────────────────────────

  test('Open grid → tap day → SPLIT → am:IN → pm:OUT → week_split_reason:VL → editMessageText called', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:SPLIT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_am:IN'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_pm:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_split_reason:VL'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenCalled()

    // Last editMessageText should be a grid refresh (contains date range)
    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  // ── 6. Back button ───────────────────────────────────────────────────────────

  test('Open grid → tap day → week_back → editMessageText called (back to grid)', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))

    const editsBefore = bot.editMessageText.mock.calls.length

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_back'))

    expect(bot.editMessageText.mock.calls.length).toBeGreaterThan(editsBefore)

    // The grid-refresh call should contain the date range
    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  // ── 7. All IN ────────────────────────────────────────────────────────────────

  test('Open grid → week_all_in → upsert called for all days IN, editMessageText with confirm', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_all_in'))

    expect(prisma.availability.upsert).toHaveBeenCalled()

    // All upsert calls should have status IN
    for (const call of prisma.availability.upsert.mock.calls) {
      expect(call[0].create.status).toBe('IN')
    }

    // editMessageText should show confirmation
    expect(bot.editMessageText).toHaveBeenCalled()
    const confirmText = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1][0]
    expect(confirmText).toMatch(/done/i)
  })

  // ── 8. Confirm with days set ─────────────────────────────────────────────────

  test('Mark one day IN → week_confirm → upsert called once with status IN', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:IN'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_confirm'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = prisma.availability.upsert.mock.calls[0][0]
    expect(upsertArg.create.status).toBe('IN')

    // Confirmation text via editMessageText
    const lastEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(lastEdit[0]).toMatch(/done/i)
  })

  // ── 9. Confirm with 0 days ───────────────────────────────────────────────────

  test('Open grid → week_confirm with nothing set → no upsert, answerCallbackQuery with alert text', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_confirm'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()

    // answerCallbackQuery is always called (ack), but look for the specific "Select a day" one
    const alertCall = bot.answerCallbackQuery.mock.calls.find(
      c => c[1] && c[1].text && c[1].text.match(/select a day/i)
    )
    expect(alertCall).toBeDefined()
  })

  // ── 10. Cancel ───────────────────────────────────────────────────────────────

  test('Open grid → week_cancel → no upsert, editMessageText "Cancelled."', async () => {
    const { mid } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_cancel'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    const cancelCall = bot.editMessageText.mock.calls.find(c => c[0] === 'Cancelled.')
    expect(cancelCall).toBeDefined()
  })

  // ── 11. Stale session ────────────────────────────────────────────────────────

  test('week_status:IN with no grid open → editMessageText "This keyboard has expired."', async () => {
    // No grid opened — no session exists
    await handleCallbackQuery(makeCallback(USER_ID, 99, 'week_status:IN'))

    expect(prisma.availability.upsert).not.toHaveBeenCalled()
    const expiredCall = bot.editMessageText.mock.calls.find(
      c => c[0] === 'This keyboard has expired.'
    )
    expect(expiredCall).toBeDefined()
  })

  // ── 12. Typed reason ─────────────────────────────────────────────────────────

  test('Open grid → tap day → week_status:OUT → week_reason:OTHER → type reason → editMessageText (grid refresh)', async () => {
    const { mid, firstDayDate } = await openGrid()

    await handleCallbackQuery(makeCallback(USER_ID, mid, `week_day:${firstDayDate}`))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_status:OUT'))
    await handleCallbackQuery(makeCallback(USER_ID, mid, 'week_reason:OTHER'))

    // editMessageText should have shown "Type the reason."
    const typeReasonCall = bot.editMessageText.mock.calls.find(c => c[0] === 'Type the reason.')
    expect(typeReasonCall).toBeDefined()

    const editsBefore = bot.editMessageText.mock.calls.length

    // User types the reason
    await handleMessage(makeMsg(USER_ID, 'overseas trip'))

    // A new editMessageText call should have been made (grid refresh)
    expect(bot.editMessageText.mock.calls.length).toBeGreaterThan(editsBefore)

    // The new call should be the grid refresh (date range text)
    const newEdit = bot.editMessageText.mock.calls[bot.editMessageText.mock.calls.length - 1]
    expect(newEdit[0]).toMatch(/\d+ \w+ \d{4}/)
  })

  // ── 13. NSF guard ────────────────────────────────────────────────────────────

  test('NSF officer → "Plan This Week" → sendMessage text matches /NSF/i', async () => {
    ;({ bot, prisma, handlers: { handleMessage, handleCallbackQuery } } = setupMocks({ role: 'NSF' }))

    await handleMessage(makeMsg(USER_ID, '📅 Plan This Week'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const sentText = bot.sendMessage.mock.calls[0][1]
    expect(sentText).toMatch(/NSF/i)
  })

  // ── 14. Unregistered ─────────────────────────────────────────────────────────

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
