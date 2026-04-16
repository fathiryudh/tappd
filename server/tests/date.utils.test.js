'use strict'

const { parseISODateUTC, toUTCStartOfDay } = require('../src/utils/date')

describe('date utils', () => {
  test('parseISODateUTC keeps the same calendar day in UTC', () => {
    expect(parseISODateUTC('2026-04-16').toISOString()).toBe('2026-04-16T00:00:00.000Z')
  })

  test('toUTCStartOfDay does not shift Singapore dates into the previous day', () => {
    expect(toUTCStartOfDay('2026-04-16').toISOString()).toBe('2026-04-16T00:00:00.000Z')
  })
})
