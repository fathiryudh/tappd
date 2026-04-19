'use strict'

const { parseSingleDate, expandWeekdays, dateRangeMatch } = require('../../src/bot/parser')

const TODAY = '2026-04-21' // a Monday

describe('parseSingleDate', () => {
  test('slash format 21/4', () => {
    expect(parseSingleDate('21/4', TODAY)).toBe('2026-04-21')
  })

  test('slash format 21/04', () => {
    expect(parseSingleDate('21/04', TODAY)).toBe('2026-04-21')
  })

  test('slash format with year 21/4/2026', () => {
    expect(parseSingleDate('21/4/2026', TODAY)).toBe('2026-04-21')
  })

  test('named month "21 apr"', () => {
    expect(parseSingleDate('21 apr', TODAY)).toBe('2026-04-21')
  })

  test('named month "21 april"', () => {
    expect(parseSingleDate('21 april', TODAY)).toBe('2026-04-21')
  })

  test('named month "5 may"', () => {
    expect(parseSingleDate('5 may', TODAY)).toBe('2026-05-05')
  })

  test('case insensitive', () => {
    expect(parseSingleDate('21 APR', TODAY)).toBe('2026-04-21')
  })

  test('named month with explicit year "21 apr 2026"', () => {
    expect(parseSingleDate('21 apr 2026', TODAY)).toBe('2026-04-21')
  })

  test('invalid calendar date "31/2" returns null', () => {
    expect(parseSingleDate('31/2', TODAY)).toBeNull()
  })

  test('invalid string returns null', () => {
    expect(parseSingleDate('notadate', TODAY)).toBeNull()
  })

  test('empty string returns null', () => {
    expect(parseSingleDate('', TODAY)).toBeNull()
  })
})

describe('expandWeekdays', () => {
  test('Mon–Fri single week returns 5 days', () => {
    const days = expandWeekdays('2026-04-20', '2026-04-24')
    expect(days).toEqual([
      '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24',
    ])
  })

  test('skips Saturday and Sunday', () => {
    const days = expandWeekdays('2026-04-24', '2026-04-27')
    expect(days).toEqual(['2026-04-24', '2026-04-27'])
  })

  test('end before start returns empty array', () => {
    expect(expandWeekdays('2026-04-25', '2026-04-21')).toEqual([])
  })

  test('same day (weekday) returns one entry', () => {
    expect(expandWeekdays('2026-04-21', '2026-04-21')).toEqual(['2026-04-21'])
  })

  test('same day (weekend) returns empty array', () => {
    expect(expandWeekdays('2026-04-25', '2026-04-25')).toEqual([])
  })

  test('returns null for ranges over 60 weekdays', () => {
    expect(expandWeekdays('2026-01-01', '2026-12-31')).toBeNull()
  })
})

describe('dateRangeMatch', () => {
  const TODAY = '2026-04-21'

  test('ovl 21/4 to 30/4 → OUT(OVL) for all weekdays', () => {
    const records = dateRangeMatch('ovl 21/4 to 30/4', TODAY)
    expect(records).not.toBeNull()
    // 21 Apr (Mon) to 30 Apr (Thu) = 21,22,23,24,27,28,29,30 → 8 weekdays
    expect(records).toHaveLength(8)
    expect(records[0]).toEqual({ date: '2026-04-21', status: 'OUT', reason: 'OVL', notes: '' })
    expect(records.every(r => r.status === 'OUT' && r.reason === 'OVL')).toBe(true)
  })

  test('vl 5 may to 9 may → OUT(VL) Tue–Fri that week (9 May is Sat)', () => {
    const records = dateRangeMatch('vl 5 may to 9 may', TODAY)
    expect(records).not.toBeNull()
    // 5 May (Tue), 6 May (Wed), 7 May (Thu), 8 May (Fri) → 4 weekdays (9 May is Sat)
    expect(records).toHaveLength(4)
    expect(records[0]).toEqual({ date: '2026-05-05', status: 'OUT', reason: 'VL', notes: '' })
    expect(records[3]).toEqual({ date: '2026-05-08', status: 'OUT', reason: 'VL', notes: '' })
  })

  test('mc 21/4 to 25/4 → OUT(MC) four weekdays (25 Apr is Sat)', () => {
    const records = dateRangeMatch('mc 21/4 to 25/4', TODAY)
    expect(records).not.toBeNull()
    // 21 (Mon), 22 (Tue), 23 (Wed), 24 (Thu) → 4 weekdays (25 Apr is Sat)
    expect(records).toHaveLength(4)
    expect(records.every(r => r.reason === 'MC')).toBe(true)
  })

  test('wfh 28/4 to 1/5 → spans month boundary correctly', () => {
    const records = dateRangeMatch('wfh 28/4 to 1/5', TODAY)
    expect(records).not.toBeNull()
    // 28 Apr (Tue), 29 Apr (Wed), 30 Apr (Thu), 1 May (Fri) → 4 weekdays
    expect(records).toHaveLength(4)
    expect(records[3]).toEqual({ date: '2026-05-01', status: 'OUT', reason: 'WFH', notes: '' })
  })

  test('case insensitive: OVL 21/4 to 30/4', () => {
    const records = dateRangeMatch('OVL 21/4 to 30/4', TODAY)
    expect(records).not.toBeNull()
    expect(records).toHaveLength(8)
  })

  test('end before start → returns null', () => {
    expect(dateRangeMatch('ovl 30/4 to 21/4', TODAY)).toBeNull()
  })

  test('unknown reason → returns null', () => {
    expect(dateRangeMatch('holiday 21/4 to 30/4', TODAY)).toBeNull()
  })

  test('no "to" keyword → returns null', () => {
    expect(dateRangeMatch('ovl 21/4', TODAY)).toBeNull()
  })

  test('range > 60 weekdays → returns null', () => {
    expect(dateRangeMatch('ovl 1/1 to 30/6', TODAY)).toBeNull()
  })

  test('plain "ovl" (no range) → returns null', () => {
    expect(dateRangeMatch('ovl', TODAY)).toBeNull()
  })

  test('weekend-only range → returns null', () => {
    expect(dateRangeMatch('ovl 25/4 to 26/4', TODAY)).toBeNull()
  })
})

const { makeMsg, setupMocks } = require('./helpers')

const MSG_USER_ID = 200

describe('dateRangeMatch integration via handleMessage', () => {
  let bot, prisma, handlers

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-04-21T08:00:00') }) // Tuesday
    ;({ bot, prisma, handlers } = setupMocks())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('"ovl 21/4 to 25/4" saves OUT(OVL) records for weekdays', async () => {
    await handlers.handleMessage(makeMsg(MSG_USER_ID, 'ovl 21/4 to 25/4'))

    expect(prisma.availability.upsert).toHaveBeenCalled()
    const calls = prisma.availability.upsert.mock.calls
    expect(calls.every(c => c[0].create.status === 'OUT' && c[0].create.reason === 'OVL')).toBe(true)
  })

  test('"vl 21/4 to 24/4" saves OUT(VL) records', async () => {
    await handlers.handleMessage(makeMsg(MSG_USER_ID, 'vl 21/4 to 24/4'))

    expect(prisma.availability.upsert).toHaveBeenCalled()
    expect(prisma.availability.upsert.mock.calls[0][0].create).toMatchObject({ status: 'OUT', reason: 'VL' })
  })

  test('plain "ovl" (no range) still saves single record via keywordMatch', async () => {
    await handlers.handleMessage(makeMsg(MSG_USER_ID, 'ovl'))

    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
  })

  test('range > 60 weekdays falls through to keywordMatch (single day saved)', async () => {
    await handlers.handleMessage(makeMsg(MSG_USER_ID, 'ovl 1/1 to 30/6'))

    // dateRangeMatch returns null (>60 weekdays); keywordMatch still catches 'ovl' → saves today
    expect(prisma.availability.upsert).toHaveBeenCalledTimes(1)
  })
})
