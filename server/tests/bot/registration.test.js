'use strict'

const {
  makeMsg,
  makeCommandMsg,
  makeContactMsg,
  makeGroupMsg,
  makeOfficer,
  setupMocks,
} = require('./helpers')

const firstSendText = bot => bot.sendMessage.mock.calls[0]?.[1]
const firstSendMarkup = bot => bot.sendMessage.mock.calls[0]?.[2]?.reply_markup

describe('/start — unknown user', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)
  })

  it('calls sendMessage with the contact keyboard (request_contact: true)', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const markup = firstSendMarkup(bot)
    expect(markup.keyboard[0][0].request_contact).toBe(true)
  })

  it('sends the promptVerification welcome text', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    expect(firstSendText(bot)).toMatch(/verify your identity|share your phone/i)
  })
})

describe('/start — known regular officer', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer({ role: null }))
  })

  it('sends "registered as" welcome with reply keyboard', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/registered as/i)
  })

  it('attaches the persistent reply keyboard', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    const markup = firstSendMarkup(bot)
    expect(markup).toBeDefined()
    expect(markup.keyboard).toBeDefined()
    expect(markup.keyboard.length).toBeGreaterThan(0)
  })
})

describe('/start — known NSF officer', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer({ role: 'NSF' }))
  })

  it('includes NSF in the welcome text', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/NSF/i)
  })

  it('does NOT attach a reply keyboard for NSF officers', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/start'))

    const options = bot.sendMessage.mock.calls[0]?.[2]
    expect(options?.reply_markup?.keyboard).toBeUndefined()
  })
})

describe('/start — group chat', () => {
  let bot, handlers

  beforeEach(() => {
    ;({ bot, handlers } = setupMocks())
  })

  it('rejects with "only works in private chats" message', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeGroupMsg(100, '/start', 200))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/only works in private chats/i)
  })
})

describe('Phone verification — valid phone, unlinked officer', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)
    prisma.officer.findFirst.mockResolvedValue(
      makeOfficer({ telegramId: null })
    )
  })

  it('calls prisma.officer.update with the new telegramId', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6591234567'))

    expect(prisma.officer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telegramId: '100' }),
      })
    )
  })

  it('sends a "verified / welcome" confirmation', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6591234567'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/verified|welcome/i)
  })
})

describe('Phone verification — phone not in system', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findFirst.mockResolvedValue(null)
  })

  it('does NOT call prisma.officer.update', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6599999999'))

    expect(prisma.officer.update).not.toHaveBeenCalled()
  })

  it('sends "not in the system / contact your admin" message', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6599999999'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/not in the system|contact your admin/i)
  })
})

describe('Phone verification — spoofed contact (sharing someone else\'s number)', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findFirst.mockResolvedValue(makeOfficer({ telegramId: null }))
  })

  it('does NOT update when contact.user_id !== sender id', async () => {
    const { handleMessage } = handlers
    const spoofedMsg = {
      from: { id: 100, username: 'attacker', first_name: 'Attacker' },
      chat: { id: 100, type: 'private' },
      contact: { user_id: 999, phone_number: '+6591234567' },
    }
    await handleMessage(spoofedMsg)

    expect(prisma.officer.update).not.toHaveBeenCalled()
  })

  it('sends a rejection message for spoofed contacts', async () => {
    const { handleMessage } = handlers
    const spoofedMsg = {
      from: { id: 100, username: 'attacker', first_name: 'Attacker' },
      chat: { id: 100, type: 'private' },
      contact: { user_id: 999, phone_number: '+6591234567' },
    }
    await handleMessage(spoofedMsg)

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/your own contact|someone else/i)
  })
})

describe('Phone verification — phone already linked to another account', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findFirst.mockResolvedValue(
      makeOfficer({ telegramId: '999' })
    )
  })

  it('does NOT call prisma.officer.update', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6591234567'))

    expect(prisma.officer.update).not.toHaveBeenCalled()
  })

  it('sends "already linked / another account" message', async () => {
    const { handleMessage } = handlers
    await handleMessage(makeContactMsg(100, '+6591234567'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/already linked|another account/i)
  })
})

describe('/deregister — confirmation prompt', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer())
  })

  it('sends a prompt containing "delete", "confirm", and "YES"', async () => {
    const { handleCommand } = handlers
    await handleCommand(makeCommandMsg(100, '/deregister'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    const text = firstSendText(bot)
    expect(text).toMatch(/delete/i)
    expect(text).toMatch(/YES/)
  })
})

describe('/deregister — confirmed with "YES"', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer())
  })

  it('calls prisma.officer.delete with telegramId after YES confirmation', async () => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))

    await handleMessage(makeMsg(100, 'YES'))

    expect(prisma.officer.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { telegramId: '100' } })
    )
  })

  it('sends a deletion confirmation message after YES', async () => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))
    bot.sendMessage.mockClear()

    await handleMessage(makeMsg(100, 'YES'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/deleted|re-register/i)
  })
})

describe('/deregister — confirmed with lowercase "yes" variants', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer())
  })

  it.each(['yes', 'Yes', 'yEs', 'YES'])('deletes officer when user types "%s"', async (variant) => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))
    await handleMessage(makeMsg(100, variant))

    expect(prisma.officer.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { telegramId: '100' } })
    )
  })
})

describe('/deregister — cancelled with non-YES reply', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(makeOfficer())
  })

  it('does NOT call prisma.officer.delete when user types "no"', async () => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))
    await handleMessage(makeMsg(100, 'no'))

    expect(prisma.officer.delete).not.toHaveBeenCalled()
  })

  it('sends a cancellation message', async () => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))
    bot.sendMessage.mockClear()

    await handleMessage(makeMsg(100, 'no'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/cancel/i)
  })
})

describe('/deregister — no profile found', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    ;({ bot, prisma, handlers } = setupMocks())
    prisma.officer.findUnique.mockResolvedValue(null)
  })

  it('sends "no profile found" without adding to pendingDeletion', async () => {
    const { handleCommand, handleMessage } = handlers

    await handleCommand(makeCommandMsg(100, '/deregister'))

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(firstSendText(bot)).toMatch(/no profile found/i)

    bot.sendMessage.mockClear()
    prisma.officer.findUnique.mockResolvedValue(makeOfficer())
    await handleMessage(makeMsg(100, 'YES'))
    expect(prisma.officer.delete).not.toHaveBeenCalled()
  })
})
