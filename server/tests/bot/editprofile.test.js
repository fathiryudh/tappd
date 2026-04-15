// server/tests/bot/editprofile.test.js
'use strict'
const { setupMocks, makeCommandMsg, makeMsg, makeContactMsg, makeCallback, makeOfficer } = require('./helpers')

describe('/editprofile — open profile card', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('sends profile card with edit buttons', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    expect(bot.sendMessage).toHaveBeenCalledWith(
      100,
      expect.stringContaining('Your profile'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      })
    )
    const keyboard = bot.sendMessage.mock.calls[0][2].reply_markup.inline_keyboard
    const allData = keyboard.flat().map(b => b.callback_data)
    expect(allData).toContain('edit_name')
    expect(allData).toContain('edit_rank')
    expect(allData).toContain('edit_division')
    expect(allData).toContain('edit_branch')
    expect(allData).toContain('edit_phone')
    expect(allData).toContain('edit_done')
  })

  test('profile card shows current values', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const text = bot.sendMessage.mock.calls[0][1]
    expect(text).toContain('Test Officer')
    expect(text).toContain('CPT')
    expect(text).toContain('2nd Div')
    expect(text).toContain('Ops')
    expect(text).toContain('+6591234567')
  })

  test('unregistered user gets verification prompt', async () => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)
    await handlers.handleCommand(makeCommandMsg('999', '/editprofile'))
    expect(bot.sendMessage).toHaveBeenCalledWith(
      100,
      expect.stringContaining('verify'),
      expect.anything()
    )
  })
})

describe('/editprofile — edit name', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Name prompts to type name', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    expect(bot.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('name'),
      expect.objectContaining({ chat_id: 100, message_id: msgId })
    )
  })

  test('typing new name updates officer and shows profile card', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleMessage(makeMsg('100', 'ME2 Ali Hassan'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'ME2 Ali Hassan' }) })
    )
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('Your profile'),
      expect.objectContaining({ message_id: msgId })
    )
  })

  test('empty name is rejected with error message', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleMessage(makeMsg('100', '   '))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenLastCalledWith(100, expect.stringContaining('empty'))
  })
})

describe('/editprofile — edit rank', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('typing new rank updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_rank'))
    await handlers.handleMessage(makeMsg('100', 'ME3'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rank: 'ME3' }) })
    )
  })
})

describe('/editprofile — edit division', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Division shows division keyboard from DB', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    const keyboard = bot.editMessageText.mock.calls.at(-1)[1].reply_markup.inline_keyboard
    const labels = keyboard.flat().map(b => b.text)
    expect(labels).toContain('2nd Div')
    expect(labels).toContain('SCDF HQ')
    expect(labels).toContain('✏️ Other (type it)')
  })

  test('selecting a known division updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_div:div_2'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ divisionId: 'div_2' }) })
    )
  })

  test('Other → type new division → upserts and links', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_division_other'))
    await handlers.handleMessage(makeMsg('100', '5th Division'))
    expect(prisma.division.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: '5th Division' }, create: { name: '5th Division' } })
    )
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ divisionId: 'div_new' }) })
    )
  })
})

describe('/editprofile — edit branch', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Branch shows branch keyboard from DB', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    const keyboard = bot.editMessageText.mock.calls.at(-1)[1].reply_markup.inline_keyboard
    const labels = keyboard.flat().map(b => b.text)
    expect(labels).toContain('Ops')
    expect(labels).toContain('✏️ Other (type it)')
  })

  test('selecting a known branch updates officer', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_br:br_1'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 'br_1' }) })
    )
  })

  test('Other → type new branch → upserts and links', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_branch_other'))
    await handlers.handleMessage(makeMsg('100', 'G3 OPS'))
    expect(prisma.branch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'G3 OPS' }, create: { name: 'G3 OPS' } })
    )
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 'br_new' }) })
    )
  })
})

describe('/editprofile — edit phone', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('tapping Edit Phone sends contact keyboard in a separate message', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    const calls = bot.sendMessage.mock.calls
    const contactCall = calls.find(c => c[2]?.reply_markup?.keyboard)
    expect(contactCall).toBeDefined()
    expect(contactCall[2].reply_markup.keyboard[0][0].request_contact).toBe(true)
  })

  test('sharing a new phone updates phoneNumber', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    prisma.officer.findFirst.mockResolvedValue(null) // not taken
    await handlers.handleMessage(makeContactMsg('100', '+6598765432'))
    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phoneNumber: '98765432' }) })
    )
  })

  test('phone already linked to another officer is rejected', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_phone'))
    // Different officer has the number
    prisma.officer.findFirst.mockResolvedValue(makeOfficer({ id: 'off_other', telegramId: '999' }))
    await handlers.handleMessage(makeContactMsg('100', '+6598765432'))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.sendMessage).toHaveBeenCalledWith(100, expect.stringContaining('linked to another account'))
  })
})

describe('/editprofile — done and cancel', () => {
  let bot, prisma, handlers
  beforeEach(() => ({ bot, prisma, handlers } = setupMocks()))
  afterEach(() => jest.clearAllMocks())

  test('Done clears session and confirms', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_done'))
    expect(bot.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('saved'),
      expect.objectContaining({ reply_markup: { inline_keyboard: [] } })
    )
  })

  test('Cancel mid name-edit returns to profile card without saving', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_cancel'))
    expect(prisma.officer.update).not.toHaveBeenCalled()
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('Your profile'),
      expect.objectContaining({ message_id: msgId })
    )
  })

  test('stale keyboard after Done → expired', async () => {
    await handlers.handleCommand(makeCommandMsg('100', '/editprofile'))
    const msgId = (await bot.sendMessage.mock.results[0].value).message_id
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_done'))
    // tap old button on same message
    await handlers.handleCallbackQuery(makeCallback('100', msgId, 'edit_name'))
    expect(bot.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining('expired'),
      expect.objectContaining({ message_id: msgId })
    )
  })
})
