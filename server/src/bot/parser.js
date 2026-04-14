// Pure JS date utilities and keyword matching — no external API calls

// --- Date helpers ---

function addDays(isoDate, n) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function getMondayOfWeek(isoDate) {
  const d = new Date(isoDate)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function getNextWeekMonday(isoDate) {
  return addDays(getMondayOfWeek(isoDate), 7)
}

// Next occurrence of targetDow (1=Mon…5=Fri), starting from tomorrow
// (Today is handled explicitly with the "Today" button)
function getDayISO(targetDow, todayISO) {
  const d = new Date(todayISO)
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== targetDow) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString().split('T')[0]
}

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

module.exports = { expandRecords, keywordMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday }
