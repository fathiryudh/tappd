const { addDays, getMondayOfWeek, getNextWeekMonday, getDayISO } = require('../utils/date')

// Pure JS date utilities and keyword matching — no external API calls

// --- Expansion ---

function expandRecords(records, todayISO) {
  const expanded = []

  for (const r of records) {
    const base = {
      status: r.status,
      reason: r.reason || null,
      notes: r.notes || '',
      splitDay: !!r.splitDay,
    }

    if (r.weekRange === 'next') {
      const mon = getNextWeekMonday(todayISO)
      for (let i = 0; i <= 4; i++) {
        expanded.push({ ...base, date: addDays(mon, i) })
      }
    } else if (r.weekRange === 'this') {
      const mon = getMondayOfWeek(todayISO)
      for (let i = 0; i <= 4; i++) {
        const d = addDays(mon, i)
        if (d >= todayISO) expanded.push({ ...base, date: d })
      }
    } else if (r.onwards) {
      const start = new Date(r.date)
      const dow = start.getDay()
      const daysLeft = dow >= 1 && dow <= 5 ? 5 - dow : 0
      for (let i = 0; i <= daysLeft; i++) {
        expanded.push({ ...base, date: addDays(r.date, i) })
      }
    } else {
      expanded.push({ ...base, date: r.date })
    }
  }

  return expanded
}

// --- Input sanitization ---

function sanitizeInput(raw) {
  if (typeof raw !== 'string') return ''
  // Truncate to 500 chars
  let s = raw.slice(0, 500)
  // Strip control characters except newline/tab
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return s.trim()
}

// --- Keyword shortcut matching ---
// Returns an array of records if the message matches a known shortcut,
// or null if no match (caller should show the keyboard instead).

function keywordMatch(raw, todayISO, tomorrowISO) {
  const lower = raw.toLowerCase().trim()
  const hasTmr = /\b(tmr|tmrw|tomorrow)\b/.test(lower)
  const dateISO = hasTmr ? tomorrowISO : todayISO

  // IN shortcuts
  if (/^(in|reporting|roger|available|报到)(\s+(tmr|tmrw|tomorrow))?$/.test(lower))
    return [{ status: 'IN', date: dateISO, reason: null, notes: '' }]
  if (/^in\s+(today|tdy)$/.test(lower))
    return [{ status: 'IN', date: todayISO, reason: null, notes: '' }]

  // OUT shortcuts — only match if there's a clear reason keyword
  if (/\bmc\b|sick|unwell|fever/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'MC', notes: '' }]
  if (/\bovl\b|overseas/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'OVL', notes: '' }]
  if (/\boil\b/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'OIL', notes: '' }]
  if (/\bwfh\b/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'WFH', notes: '' }]
  if (/\bvl\b|\bal\b/.test(lower) && !/\boval\b/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'VL', notes: '' }]
  if (/\bcourse\b|training/.test(lower))
    return [{ status: 'OUT', date: dateISO, reason: 'Course', notes: '' }]

  // No keyword match — caller shows keyboard
  return null
}

// --- Multi-day free-text matching ---
// Parses inputs like "mon in, tue mc, wed vl" or "14 apr in, 15 apr mc"
// Returns array of records (same shape as keywordMatch) or null if no match.

const MONTH_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
}

const DAY_DOW = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
}

function parseStatusToken(t) {
  const lower = t.toLowerCase()
  if (lower === 'in' || lower === 'reporting') return { status: 'IN', reason: null }
  if (lower === 'mc' || lower === 'sick' || lower === 'unwell') return { status: 'OUT', reason: 'MC' }
  if ((lower === 'vl' || lower === 'al') && lower !== 'oval') return { status: 'OUT', reason: 'VL' }
  if (lower === 'wfh') return { status: 'OUT', reason: 'WFH' }
  if (lower === 'ovl' || lower === 'overseas') return { status: 'OUT', reason: 'OVL' }
  if (lower === 'oil') return { status: 'OUT', reason: 'OIL' }
  if (lower === 'course' || lower === 'training') return { status: 'OUT', reason: 'Course' }
  if (lower === 'appointment') return { status: 'OUT', reason: 'Appointment' }
  return null
}

function parseMultiDayEntry(tokens, todayISO) {
  if (tokens.length < 2) return null
  const first = tokens[0]

  // Day name: "mon in", "tuesday mc"
  if (DAY_DOW[first] !== undefined) {
    const date = getDayISO(DAY_DOW[first], todayISO)
    const statusInfo = parseStatusToken(tokens[1])
    if (statusInfo) return { date, ...statusInfo, notes: '' }
    return null
  }

  // Slash date: "14/4 in", "14/04 mc"
  const slashMatch = first.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10)
    const month = parseInt(slashMatch[2], 10)
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date(todayISO).getFullYear()
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const statusInfo = parseStatusToken(tokens[1])
    if (statusInfo) return { date, ...statusInfo, notes: '' }
    return null
  }

  // Numeric day + month name: "14 apr in"
  const dayNum = parseInt(first, 10)
  if (!isNaN(dayNum) && first === String(dayNum) && tokens.length >= 3) {
    const monthNum = MONTH_MAP[tokens[1]]
    if (monthNum) {
      let statusIdx = 2
      let year = new Date(todayISO).getFullYear()
      const possibleYear = parseInt(tokens[2], 10)
      if (!isNaN(possibleYear) && possibleYear > 2020) { year = possibleYear; statusIdx = 3 }
      if (tokens[statusIdx]) {
        const statusInfo = parseStatusToken(tokens[statusIdx])
        if (statusInfo) {
          const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          return { date, ...statusInfo, notes: '' }
        }
      }
    }
  }

  return null
}

function multiDayMatch(raw, todayISO) {
  // Try comma-separated entries first
  const commaParts = raw.split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
  if (commaParts.length >= 2) {
    const records = commaParts
      .map(part => parseMultiDayEntry(part.split(/\s+/), todayISO))
      .filter(Boolean)
    if (records.length >= 2) return records
  }

  // Try space-separated scan: "mon in tue mc wed vl"
  const tokens = raw.toLowerCase().trim().split(/\s+/)
  const records = []
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]

    // Day name token
    if (DAY_DOW[t] !== undefined && tokens[i + 1]) {
      const date = getDayISO(DAY_DOW[t], todayISO)
      const statusInfo = parseStatusToken(tokens[i + 1])
      if (statusInfo) { records.push({ date, ...statusInfo, notes: '' }); i += 2; continue }
    }

    // Slash date token
    const slashMatch = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
    if (slashMatch && tokens[i + 1]) {
      const day = parseInt(slashMatch[1], 10)
      const month = parseInt(slashMatch[2], 10)
      const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date(todayISO).getFullYear()
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const statusInfo = parseStatusToken(tokens[i + 1])
      if (statusInfo) { records.push({ date, ...statusInfo, notes: '' }); i += 2; continue }
    }

    // Numeric day + month name
    const dayNum = parseInt(t, 10)
    if (!isNaN(dayNum) && t === String(dayNum) && tokens[i + 1]) {
      const monthNum = MONTH_MAP[tokens[i + 1]]
      if (monthNum) {
        let statusIdx = i + 2
        let year = new Date(todayISO).getFullYear()
        const possibleYear = parseInt(tokens[i + 2], 10)
        if (!isNaN(possibleYear) && possibleYear > 2020) { year = possibleYear; statusIdx = i + 3 }
        if (tokens[statusIdx]) {
          const statusInfo = parseStatusToken(tokens[statusIdx])
          if (statusInfo) {
            const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            records.push({ date, ...statusInfo, notes: '' })
            i = statusIdx + 1
            continue
          }
        }
      }
    }

    i++
  }

  if (records.length >= 2) return records
  return null
}

module.exports = { expandRecords, keywordMatch, multiDayMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput }
