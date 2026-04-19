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

  test('caps at 61 entries for very long ranges', () => {
    const days = expandWeekdays('2026-01-01', '2026-12-31')
    expect(days.length).toBeGreaterThan(60)
    expect(days.length).toBeLessThanOrEqual(61)
  })
})
