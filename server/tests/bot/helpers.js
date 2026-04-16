// @ts-check
'use strict'

/**
 * @typedef {import('@prisma/client').Officer} PrismaOfficer
 * @typedef {import('@prisma/client').Division} PrismaDivision
 * @typedef {import('@prisma/client').Branch} PrismaBranch
 * @typedef {import('@prisma/client').Availability} PrismaAvailability
 * @typedef {typeof import('../../src/bot/telegram')} TelegramHandlers
 */

/**
 * @typedef {Omit<PrismaOfficer, 'role'> & {
 *   role: PrismaOfficer['role'] | null,
 *   division: PrismaDivision | null,
 *   branch: PrismaBranch | null,
 *   availability: PrismaAvailability[],
 * }} OfficerFixture
 */

/**
 * @typedef {{
 *   from: { id: number, username?: string, first_name?: string },
 *   chat: { id: number, type: 'private' | 'group' },
 *   text?: string,
 *   contact?: { user_id: number, phone_number: string },
 * }} TelegramMessageFixture
 */

/**
 * @typedef {{
 *   id: string,
 *   from: { id: number },
 *   message: { message_id: number, chat: { id: number, type: 'private' | 'group' } },
 *   data: string,
 * }} TelegramCallbackFixture
 */

/**
 * @typedef {{
 *   sendMessage: jest.Mock<Promise<{ message_id: number }>, [number, string, ...(object | undefined)[]]>,
 *   editMessageText: jest.Mock<Promise<object>, [string, object]>,
 *   editMessageReplyMarkup: jest.Mock<Promise<object>, [object, object]>,
 *   answerCallbackQuery: jest.Mock<Promise<object>, [string, ...(object | undefined)[]]>,
 *   setMyCommands: jest.Mock<Promise<object>, [Array<{ command: string, description: string }>]>,
 * }} BotMock
 */

/**
 * @typedef {{
 *   officer: {
 *     findUnique: jest.Mock<Promise<OfficerFixture | null>, [object]>,
 *     findFirst: jest.Mock<Promise<OfficerFixture | null>, [object]>,
 *     findMany: jest.Mock<Promise<OfficerFixture[]>, [object?]>,
 *     update: jest.Mock<Promise<OfficerFixture>, [object]>,
 *     delete: jest.Mock<Promise<OfficerFixture>, [object]>,
 *     create: jest.Mock<Promise<OfficerFixture>, [object]>,
 *   },
 *   availability: {
 *     upsert: jest.Mock<Promise<object>, [object]>,
 *     findMany: jest.Mock<Promise<PrismaAvailability[]>, [object?]>,
 *     findFirst: jest.Mock<Promise<PrismaAvailability | null>, [object?]>,
 *   },
 *   division: {
 *     findMany: jest.Mock<Promise<PrismaDivision[]>, [object?]>,
 *     findFirst: jest.Mock<Promise<PrismaDivision | null>, [object?]>,
 *     upsert: jest.Mock<Promise<PrismaDivision>, [{ create: Pick<PrismaDivision, 'name'> }]>,
 *   },
 *   branch: {
 *     findMany: jest.Mock<Promise<PrismaBranch[]>, [object?]>,
 *     upsert: jest.Mock<Promise<PrismaBranch>, [{ create: Pick<PrismaBranch, 'name'> }]>,
 *   },
 *   notificationEvent: {
 *     create: jest.Mock<Promise<{ id: string }>, [object]>,
 *   },
 * }} PrismaMock
 */

/**
 * @typedef {{
 *   bot: BotMock,
 *   prisma: PrismaMock,
 *   handlers: TelegramHandlers,
 * }} SetupMocksResult
 */

let callbackSeq = 0

function makePrivateMessage(telegramId, chatId = 100, extra = {}) {
  return {
    from: {
      id: Number.parseInt(String(telegramId), 10),
      username: 'testuser',
      first_name: 'Test',
    },
    chat: { id: chatId, type: 'private' },
    ...extra,
  }
}

/** @returns {TelegramMessageFixture} */
function makeMsg(telegramId, text, chatId = 100) {
  return makePrivateMessage(telegramId, chatId, { text })
}

/** @returns {TelegramCallbackFixture} */
function makeCallback(telegramId, messageId, data, chatId = 100) {
  return {
    id: `cbq_${++callbackSeq}`,
    from: { id: Number.parseInt(String(telegramId), 10) },
    message: {
      message_id: messageId,
      chat: { id: chatId, type: 'private' },
    },
    data,
  }
}

function makeCommandMsg(telegramId, text, chatId = 100) {
  return makeMsg(telegramId, text, chatId)
}

/** @returns {TelegramMessageFixture} */
function makeContactMsg(telegramId, phone, chatId = 100) {
  return makePrivateMessage(telegramId, chatId, {
    contact: { user_id: Number.parseInt(String(telegramId), 10), phone_number: phone },
  })
}

/** @returns {TelegramMessageFixture} */
function makeGroupMsg(telegramId, text, chatId = 200) {
  return {
    from: {
      id: Number.parseInt(String(telegramId), 10),
      username: 'testuser',
      first_name: 'Test',
    },
    chat: { id: chatId, type: 'group' },
    text,
  }
}

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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function setupMocks(officerOverrides = {}) {
  jest.resetModules()

  let msgIdSeq = 0

  /** @type {BotMock} */
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

  /** @type {PrismaMock} */
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
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'div_new', name: create.name })),
    },
    branch: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'br_1', name: 'Ops' },
      ]),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'br_new', name: create.name })),
    },
    notificationEvent: {
      create: jest.fn().mockResolvedValue({ id: 'note_1' }),
    },
  }

  jest.doMock('node-telegram-bot-api', () => jest.fn(() => bot))
  jest.doMock('../../src/config/prisma', () => prisma)

  /** @type {TelegramHandlers} */
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
