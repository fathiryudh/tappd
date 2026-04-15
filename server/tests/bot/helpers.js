// server/tests/bot/helpers.js
'use strict'

/** Build a private text message from a user */
function makeMsg(telegramId, text, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    text,
  }
}

/** Build an inline keyboard callback query */
function makeCallback(telegramId, messageId, data, chatId = 100) {
  return {
    id: 'cbq_' + Math.random().toString(36).slice(2),
    from: { id: parseInt(telegramId) },
    message: {
      message_id: messageId,
      chat: { id: chatId, type: 'private' },
    },
    data,
  }
}

/** Build a slash command message */
function makeCommandMsg(telegramId, text, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    text,
  }
}

/** Build a contact-sharing message (phone verification) */
function makeContactMsg(telegramId, phone, chatId = 100) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'private' },
    contact: { user_id: parseInt(telegramId), phone_number: phone },
  }
}

/** Build a group chat message (should be rejected by bot) */
function makeGroupMsg(telegramId, text, chatId = 200) {
  return {
    from: { id: parseInt(telegramId), username: 'testuser', first_name: 'Test' },
    chat: { id: chatId, type: 'group' },
    text,
  }
}

/** Default registered officer stub — override any field with overrides.
 *  division and branch are relation objects (matching Prisma include shape).
 */
function makeOfficer(overrides = {}) {
  return {
    id: 'off_1',
    telegramId: '100',
    telegramName: 'testuser',
    name: 'Test Officer',
    rank: 'CPT',
    role: null,
    divisionId: 'div_1',
    division: { id: 'div_1', name: '2nd Div' },
    branchId: 'br_1',
    branch: { id: 'br_1', name: 'Ops' },
    phoneNumber: '+6591234567',
    adminId: 'adm_1',
    availability: [],
    ...overrides,
  }
}

/**
 * Call this in beforeEach. Returns { bot, prisma, handlers }.
 * Uses jest.resetModules() + jest.doMock() so telegram.js reloads
 * with empty session Maps on every test.
 */
function setupMocks(officerOverrides = {}) {
  jest.resetModules()

  let msgIdSeq = 0

  const bot = {
    sendMessage: jest.fn().mockImplementation(() =>
      Promise.resolve({ message_id: ++msgIdSeq })
    ),
    editMessageText: jest.fn().mockResolvedValue({}),
    editMessageReplyMarkup: jest.fn().mockResolvedValue({}),
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
    setMyCommands: jest.fn().mockResolvedValue({}),
  }

  const officer = makeOfficer(officerOverrides)

  const prisma = {
    officer: {
      findUnique: jest.fn().mockResolvedValue(officer),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(officer),
      delete: jest.fn().mockResolvedValue(officer),
      create: jest.fn().mockResolvedValue(officer),
    },
    availability: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    division: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'div_1', name: '2nd Div' },
        { id: 'div_2', name: 'SCDF HQ' },
      ]),
      findFirst: jest.fn().mockResolvedValue({ id: 'div_1', name: '2nd Div' }),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'div_new', ...create })),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'br_1', name: 'Ops' },
      ]),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'br_new', ...create })),
    },
  }

  jest.doMock('node-telegram-bot-api', () => jest.fn(() => bot))
  jest.doMock('../../src/config/prisma', () => prisma)

  const handlers = require('../../src/bot/telegram')

  return { bot, prisma, handlers }
}

module.exports = {
  makeMsg,
  makeCallback,
  makeCommandMsg,
  makeContactMsg,
  makeGroupMsg,
  makeOfficer,
  setupMocks,
}
