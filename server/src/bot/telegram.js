const TelegramBot = require('node-telegram-bot-api')
const prisma = require('../config/prisma')
const { expandRecords, keywordMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday } = require('./parser')

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)

// ── Session stores ────────────────────────────────────────────────────────────
// Availability session: telegramId → { step, status, reason, splitDay, amStatus, pmStatus, outReason, chatId, messageId }
const sessions = new Map()
// Registration session: telegramId → { step: 'rank' | 'name', rank: string, telegramName: string }
const pendingRegistration = new Map()
// Week planner session: telegramId → {
//   step: 'GRID' | 'DAY_STATUS' | 'DAY_SPLIT_AM' | 'DAY_SPLIT_PM' | 'DAY_REASON' | 'DAY_REASON_TEXT' | 'DAY_SPLIT_REASON' | 'DAY_SPLIT_REASON_TEXT',
//   weekDates: string[],          // ['2026-04-14', ..., '2026-04-18']
//   days: Record<string, {        // keyed by ISO date
//     status: 'IN'|'OUT', reason: string|null, notes: string,
//     splitDay: boolean, amStatus?: 'IN'|'OUT', pmStatus?: 'IN'|'OUT', outReason?: string|null
//   }>,
//   currentDay: string|null,
//   chatId: number,
//   messageId: number,
// }
const weekSessions = new Map()

// ── Keyboard builders ─────────────────────────────────────────────────────────

function statusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅  In', callback_data: 'status:IN' },
        { text: '❌  Out', callback_data: 'status:OUT' },
      ],
      [{ text: '↔️  Split Day (AM/PM different)', callback_data: 'status:SPLIT' }],
      [{ text: '❌  Cancel', callback_data: 'cancel' }],
    ],
  }
}

// prefix = 'reason' for full OUT, 'splitreason' for split-day OUT half
function reasonKeyboard(prefix = 'reason') {
  const p = prefix
  return {
    inline_keyboard: [
      [
        { text: 'MC', callback_data: `${p}:MC` },
        { text: 'VL', callback_data: `${p}:VL` },
        { text: 'OVL', callback_data: `${p}:OVL` },
        { text: 'OIL', callback_data: `${p}:OIL` },
      ],
      [
        { text: 'WFH', callback_data: `${p}:WFH` },
        { text: 'Course', callback_data: `${p}:Course` },
        { text: 'Appointment', callback_data: `${p}:Appointment` },
        { text: 'Family Emergency', callback_data: `${p}:Family Emergency` },
      ],
      [{ text: '✏️  Other (type it)', callback_data: `${p}:OTHER` }],
      [{ text: '❌  Cancel', callback_data: 'cancel' }],
    ],
  }
}

function amStatusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅  In (Morning)', callback_data: 'am:IN' },
        { text: '❌  Out (Morning)', callback_data: 'am:OUT' },
      ],
      [{ text: '❌  Cancel', callback_data: 'cancel' }],
    ],
  }
}

function pmStatusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅  In (Afternoon)', callback_data: 'pm:IN' },
        { text: '❌  Out (Afternoon)', callback_data: 'pm:OUT' },
      ],
      [{ text: '❌  Cancel', callback_data: 'cancel' }],
    ],
  }
}

function dateKeyboard(todayISO, tomorrowISO, isSplitDay = false) {
  const fmtBtn = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
  }
  const dayRow = [
    { text: `Mon ${fmtBtn(getDayISO(1, todayISO))}`, callback_data: 'date:mon' },
    { text: `Tue ${fmtBtn(getDayISO(2, todayISO))}`, callback_data: 'date:tue' },
    { text: `Wed ${fmtBtn(getDayISO(3, todayISO))}`, callback_data: 'date:wed' },
    { text: `Thu ${fmtBtn(getDayISO(4, todayISO))}`, callback_data: 'date:thu' },
    { text: `Fri ${fmtBtn(getDayISO(5, todayISO))}`, callback_data: 'date:fri' },
  ]
  const keyboard = [
    [
      { text: `Today (${fmtBtn(todayISO)})`, callback_data: 'date:today' },
      { text: `Tmr (${fmtBtn(tomorrowISO)})`, callback_data: 'date:tmr' },
    ],
    dayRow,
  ]
  if (!isSplitDay) {
    keyboard.push([
      { text: '📆  This Week', callback_data: 'date:thisweek' },
      { text: '📆  Next Week', callback_data: 'date:nextweek' },
    ])
  }
  keyboard.push([{ text: '❌  Cancel', callback_data: 'cancel' }])
  return { inline_keyboard: keyboard }
}

function replyKeyboardMarkup() {
  return {
    keyboard: [
      [{ text: '📋 Report Today' }, { text: '📅 Plan This Week' }],
      [{ text: '📅 Plan Next Week' }, { text: '📊 My Status' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

// ── Week grid utilities ───────────────────────────────────────────────────────

// Returns array of 5 ISO date strings (Mon–Fri).
// For "this week": only days >= today. For "next week": full Mon–Fri.
// Edge case: if called on weekend for "this week", returns full next Mon–Fri (same as next week).
function getWeekDates(isNextWeek, todayISO) {
  if (isNextWeek) {
    const mon = getNextWeekMonday(todayISO)
    return [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  }
  // this week
  const mon = getMondayOfWeek(todayISO)
  const allDays = [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  const remaining = allDays.filter(d => d >= todayISO)
  // if weekend, remaining is empty — fall back to next week
  if (remaining.length === 0) {
    const nextMon = getNextWeekMonday(todayISO)
    return [0, 1, 2, 3, 4].map(i => addDays(nextMon, i))
  }
  return remaining
}

// Returns the button label for one day in the grid.
// days is the weekSession.days Record.
function dayLabel(isoDate, days) {
  const d = new Date(isoDate)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const name = dayNames[d.getDay()]
  const num = d.getDate()
  const entry = days[isoDate]
  if (!entry) return `${name} ${num} —`
  if (entry.splitDay) return `${name} ${num} ↔️`
  if (entry.status === 'IN') return `${name} ${num} ✅`
  const r = entry.reason ? entry.reason.slice(0, 4) : ''
  return `${name} ${num} ❌${r}`
}

// Returns the text body for the grid message.
function buildWeekGridText(weekSession) {
  const first = weekSession.weekDates[0]
  const last = weekSession.weekDates[weekSession.weekDates.length - 1]
  const fmt = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()}`
  }
  return `📅 Week of ${fmt(first)} – ${fmt(last)}\nTap a day to set your status.`
}

// Returns the inline_keyboard for the grid message.
function buildWeekGridKeyboard(weekSession) {
  const { weekDates, days } = weekSession
  // Row 1: days 0-2, Row 2: days 3-4
  const row1 = weekDates.slice(0, 3).map(d => ({
    text: dayLabel(d, days),
    callback_data: `week_day:${d}`,
  }))
  const row2 = weekDates.slice(3).map(d => ({
    text: dayLabel(d, days),
    callback_data: `week_day:${d}`,
  }))

  // Count set days
  const setDates = weekDates.filter(d => days[d])
  const unsetDates = weekDates.filter(d => !days[d])
  const setCount = setDates.length

  // Bottom action rows
  const actionRow = []
  if (setCount > 0) {
    actionRow.push({ text: `✅ Confirm (${setCount} set)`, callback_data: 'week_confirm' })
  }
  if (unsetDates.length > 0) {
    const allInLabel = setCount === 0 ? '✅ All IN this week' : '✅ All IN remaining'
    actionRow.push({ text: allInLabel, callback_data: 'week_all_in' })
  }

  const cancelRow = [{ text: '❌ Cancel', callback_data: 'week_cancel' }]

  const keyboard = [row1]
  if (row2.length > 0) keyboard.push(row2)
  if (actionRow.length > 0) keyboard.push(actionRow)
  keyboard.push(cancelRow)

  return { inline_keyboard: keyboard }
}

// Opens (or re-opens) the week grid for an officer.
// Pre-fills days from existing DB records.
async function openWeekGrid(telegramId, chatId, isNextWeek, todayISO) {
  const weekDates = getWeekDates(isNextWeek, todayISO)

  // Load existing records for this week so we can pre-fill the grid
  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  const existing = officer
    ? await prisma.availability.findMany({
        where: {
          officerId: officer.id,
          date: { in: weekDates.map(d => new Date(d)) },
        },
      })
    : []

  // Build pre-filled days map from existing records
  const days = {}
  for (const rec of existing) {
    const iso = rec.date.toISOString().split('T')[0]
    days[iso] = {
      status: rec.status,
      reason: rec.reason || null,
      notes: rec.notes || '',
      splitDay: !!(rec.notes && rec.notes.includes('AM')),
    }
  }

  const session = {
    step: 'GRID',
    weekDates,
    days,
    currentDay: null,
    chatId,
    messageId: null,
  }
  weekSessions.set(telegramId, session)

  const text = buildWeekGridText(session)
  const reply_markup = buildWeekGridKeyboard(session)
  const sent = await bot.sendMessage(chatId, text, { reply_markup })
  session.messageId = sent.message_id
}

async function handleWeekCallback(query, officer, telegramId, chatId, messageId, data, todayISO, tomorrowISO) {
  const session = weekSessions.get(telegramId)
  if (!session) {
    await bot.editMessageText("This keyboard has expired 😅 Say anything to start again!", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // Helper: refresh the grid message in-place
  const refreshGrid = async () => {
    const text = buildWeekGridText(session)
    const reply_markup = buildWeekGridKeyboard(session)
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup })
  }

  // ── week_cancel ──────────────────────────────────────────────────────────────
  if (data === 'week_cancel') {
    weekSessions.delete(telegramId)
    await bot.editMessageText('Cancelled! 😊 Say anything to start again.', {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // ── week_all_in ──────────────────────────────────────────────────────────────
  if (data === 'week_all_in') {
    const unsetDates = session.weekDates.filter(d => !session.days[d])
    for (const d of unsetDates) {
      session.days[d] = { status: 'IN', reason: null, notes: '', splitDay: false }
    }
    // Submit all set days
    const records = session.weekDates
      .filter(d => session.days[d])
      .map(d => ({ ...session.days[d], date: d }))
    weekSessions.delete(telegramId)
    await storeAndConfirm(records, officer, chatId, 'week_all_in', messageId)
    return
  }

  // ── week_confirm ─────────────────────────────────────────────────────────────
  if (data === 'week_confirm') {
    const records = session.weekDates
      .filter(d => session.days[d])
      .map(d => ({ ...session.days[d], date: d }))
    if (records.length === 0) {
      // Nothing set — toast, keep grid open
      await bot.answerCallbackQuery(query.id, {
        text: "Nothing set yet — tap a day first 😄",
        show_alert: false,
      })
      return
    }
    weekSessions.delete(telegramId)
    await storeAndConfirm(records, officer, chatId, 'week_confirm', messageId)
    return
  }

  // ── week_day:<date> — officer tapped a day in the grid ────────────────────────
  if (data.startsWith('week_day:')) {
    const date = data.slice(9)
    session.currentDay = date
    session.step = 'DAY_STATUS'

    const d = new Date(date)
    const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}`
    await bot.editMessageText(`${label} — what's your status? 👇`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ In', callback_data: 'week_status:IN' },
            { text: '❌ Out...', callback_data: 'week_status:OUT' },
            { text: '↔️ Split', callback_data: 'week_status:SPLIT' },
          ],
          [{ text: '← Back to week', callback_data: 'week_back' }],
        ],
      },
    })
    return
  }

  // ── week_back — return to grid ────────────────────────────────────────────────
  if (data === 'week_back') {
    session.step = 'GRID'
    session.currentDay = null
    await refreshGrid()
    return
  }

  // ── week_status:<IN|OUT|SPLIT> ────────────────────────────────────────────────
  if (data.startsWith('week_status:')) {
    const value = data.slice(12)
    const date = session.currentDay
    if (!date) return

    if (value === 'IN') {
      session.days[date] = { status: 'IN', reason: null, notes: '', splitDay: false }
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    } else if (value === 'OUT') {
      session.step = 'DAY_REASON'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label} — what's the reason?`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'MC', callback_data: 'week_reason:MC' },
              { text: 'VL', callback_data: 'week_reason:VL' },
              { text: 'OVL', callback_data: 'week_reason:OVL' },
              { text: 'OIL', callback_data: 'week_reason:OIL' },
            ],
            [
              { text: 'WFH', callback_data: 'week_reason:WFH' },
              { text: 'Course', callback_data: 'week_reason:Course' },
              { text: 'Appointment', callback_data: 'week_reason:Appointment' },
              { text: 'Family Emergency', callback_data: 'week_reason:Family Emergency' },
            ],
            [{ text: '✏️ Other (type it)', callback_data: 'week_reason:OTHER' }],
            [{ text: '← Back to week', callback_data: 'week_back' }],
          ],
        },
      })
    } else if (value === 'SPLIT') {
      session.step = 'DAY_SPLIT_AM'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label} — morning status? 🌅`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ In (AM)', callback_data: 'week_am:IN' },
              { text: '❌ Out (AM)', callback_data: 'week_am:OUT' },
            ],
            [{ text: '← Back', callback_data: 'week_back' }],
          ],
        },
      })
    }
    return
  }

  // ── week_reason:<reason|OTHER> ────────────────────────────────────────────────
  if (data.startsWith('week_reason:')) {
    const value = data.slice(12)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_REASON_TEXT'
      await bot.editMessageText("What's the reason? Type it 👇", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '← Back to week', callback_data: 'week_back' }]] },
      })
    } else {
      session.days[date] = { status: 'OUT', reason: value, notes: '', splitDay: false }
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }

  // ── week_am:<IN|OUT> ──────────────────────────────────────────────────────────
  if (data.startsWith('week_am:')) {
    const value = data.slice(8)
    const date = session.currentDay
    if (!date) return

    // Store AM choice in session temporarily
    if (!session.days[date]) session.days[date] = { status: 'IN', reason: null, notes: '', splitDay: true }
    session.days[date].amStatus = value
    session.step = 'DAY_SPLIT_PM'

    const d = new Date(date)
    const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
    const amLabel = value === 'IN' ? '✅ In (Morning)' : '❌ Out (Morning)'
    await bot.editMessageText(`${label} ${amLabel}\n\nNow, afternoon? 🌆`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ In (PM)', callback_data: 'week_pm:IN' },
            { text: '❌ Out (PM)', callback_data: 'week_pm:OUT' },
          ],
          [{ text: '← Back', callback_data: 'week_back' }],
        ],
      },
    })
    return
  }

  // ── week_pm:<IN|OUT> ──────────────────────────────────────────────────────────
  if (data.startsWith('week_pm:')) {
    const value = data.slice(8)
    const date = session.currentDay
    if (!date) return

    const day = session.days[date] || { status: 'IN', reason: null, notes: '', splitDay: true }
    day.pmStatus = value
    day.splitDay = true
    session.days[date] = day

    const needReason = day.amStatus === 'OUT' || value === 'OUT'
    if (needReason) {
      session.step = 'DAY_SPLIT_REASON'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label} — what's the reason for the out portion?`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'MC', callback_data: 'week_split_reason:MC' },
              { text: 'VL', callback_data: 'week_split_reason:VL' },
              { text: 'OVL', callback_data: 'week_split_reason:OVL' },
              { text: 'OIL', callback_data: 'week_split_reason:OIL' },
            ],
            [
              { text: 'WFH', callback_data: 'week_split_reason:WFH' },
              { text: 'Course', callback_data: 'week_split_reason:Course' },
              { text: 'Appointment', callback_data: 'week_split_reason:Appointment' },
              { text: 'Family Emergency', callback_data: 'week_split_reason:Family Emergency' },
            ],
            [{ text: '✏️ Other (type it)', callback_data: 'week_split_reason:OTHER' }],
            [{ text: '← Back to week', callback_data: 'week_back' }],
          ],
        },
      })
    } else {
      // Both IN — finalize immediately
      day.status = 'IN'
      day.reason = null
      day.notes = 'AM in, PM in'
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }

  // ── week_split_reason:<reason|OTHER> ─────────────────────────────────────────
  if (data.startsWith('week_split_reason:')) {
    const value = data.slice(18)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_SPLIT_REASON_TEXT'
      await bot.editMessageText("What's the reason? Type it 👇", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '← Back to week', callback_data: 'week_back' }]] },
      })
    } else {
      const day = session.days[date] || { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: 'IN', pmStatus: 'IN' }
      day.outReason = value
      day.reason = value
      // Derive overall status and notes
      const amIn = day.amStatus === 'IN'
      const pmIn = day.pmStatus === 'IN'
      day.status = amIn ? 'IN' : 'OUT'
      day.notes = `${amIn ? 'AM in' : `AM out (${value})`}, ${pmIn ? 'PM in' : `PM out (${value})`}`
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRecord(r) {
  const reasonStr = r.reason ? ` — ${r.reason}` : ''
  if (r.splitDay) {
    const amHalf = r.notes?.startsWith('AM in') ? 'In' : `Out${reasonStr}`
    const pmHalf = r.notes?.includes('PM in') ? 'In' : `Out${reasonStr}`
    return `${amHalf} / ${pmHalf}`
  }
  if (r.status === 'IN') return 'In'
  return `Out${reasonStr}`
}

function buildConfirmText(name, records) {
  const openers = {
    IN: [
      `Roger that, ${name}! Seeya at station 💪`,
      `Got it ${name}, all noted lah! ✅`,
      `Yep yep, ${name} is IN 🤙`,
    ],
    OUT: [
      `Noted ${name}, rest well! 🙏`,
      `Roger ${name}, logged! Take care ya 👍`,
      `All good ${name}, enjoy the break 😊`,
    ],
    SPLIT: [
      `Split day logged, ${name}! 💡`,
      `AM/PM combo noted, ${name}! 👍`,
    ],
    MULTI: [
      `Roger that ${name}! Logged ${records.length} days 📅`,
      `All ${records.length} days noted, ${name}! 💪`,
    ],
  }
  let key = records.length > 1 ? 'MULTI' : (records[0]?.splitDay ? 'SPLIT' : (records[0]?.status || 'IN'))
  const pool = openers[key] || openers.IN
  const opener = pool[Math.floor(Math.random() * pool.length)]
  const lines = records.map(r => `${formatRecord(r)} — ${r.date}${r.notes ? ` (${r.notes})` : ''}`)
  return `${opener}\n\n${lines.join('\n')}`
}

function buildRecordsFromDateValue(value, session, todayISO, tomorrowISO) {
  let baseRecord
  if (session.splitDay) {
    const { amStatus, pmStatus, outReason } = session
    const amHalf = amStatus === 'IN' ? 'AM in' : `AM out${outReason ? ` (${outReason})` : ''}`
    const pmHalf = pmStatus === 'IN' ? 'PM in' : `PM out${outReason ? ` (${outReason})` : ''}`
    baseRecord = {
      status: amStatus,
      reason: outReason || null,
      notes: `${amHalf}, ${pmHalf}`,
      splitDay: true,
    }
  } else {
    baseRecord = { status: session.status, reason: session.reason || null, notes: '', splitDay: false }
  }

  let template
  switch (value) {
    case 'today':    template = { ...baseRecord, date: todayISO }; break
    case 'tmr':      template = { ...baseRecord, date: tomorrowISO }; break
    case 'thisweek': template = { ...baseRecord, date: todayISO, weekRange: 'this' }; break
    case 'nextweek': template = { ...baseRecord, date: todayISO, weekRange: 'next' }; break
    case 'mon':      template = { ...baseRecord, date: getDayISO(1, todayISO) }; break
    case 'tue':      template = { ...baseRecord, date: getDayISO(2, todayISO) }; break
    case 'wed':      template = { ...baseRecord, date: getDayISO(3, todayISO) }; break
    case 'thu':      template = { ...baseRecord, date: getDayISO(4, todayISO) }; break
    case 'fri':      template = { ...baseRecord, date: getDayISO(5, todayISO) }; break
    default:         template = { ...baseRecord, date: todayISO }
  }

  return expandRecords([{ ...template, onwards: false, weekRange: template.weekRange || null }], todayISO)
}

async function storeAndConfirm(records, officer, chatId, rawMessage, messageId = null) {
  for (const record of records) {
    await prisma.availability.upsert({
      where: {
        officerId_date: {
          officerId: officer.id,
          date: new Date(record.date),
        },
      },
      update: {
        status: record.status,
        reason: record.reason,
        rawMessage: rawMessage || '',
        notes: record.notes || null,
      },
      create: {
        officerId: officer.id,
        date: new Date(record.date),
        status: record.status,
        reason: record.reason,
        rawMessage: rawMessage || '',
        notes: record.notes || null,
      },
    })
  }

  const displayName = officer.name || officer.telegramName || 'Officer'
  const text = buildConfirmText(displayName, records)

  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
  } else {
    await bot.sendMessage(chatId, text, { reply_markup: replyKeyboardMarkup() })
  }
}

// ── Registration helpers ───────────────────────────────────────────────────────

let cachedAdminId = null
async function getDefaultAdminId() {
  if (cachedAdminId) return cachedAdminId
  const admin = await prisma.user.findUnique({ where: { email: process.env.BOT_ADMIN_EMAIL } })
  if (!admin) throw new Error('BOT_ADMIN_EMAIL not found in DB — set this env var')
  cachedAdminId = admin.id
  return cachedAdminId
}

async function startRegistration(telegramId, chatId, fromUser) {
  const telegramName = fromUser?.username || fromUser?.first_name || ''
  pendingRegistration.set(telegramId, { step: 'rank', rank: null, telegramName })
  await bot.sendMessage(chatId, "Welcome to Yappd! What's your rank? (e.g. CPT, LTA, ME3, SGT)")
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id
  const rawMessage = msg.text?.trim()
  if (!rawMessage) return

  const todayISO = new Date().toISOString().split('T')[0]
  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // 1. Registration flow
  if (pendingRegistration.has(telegramId)) {
    const reg = pendingRegistration.get(telegramId)
    if (reg.step === 'rank') {
      const rank = rawMessage.trim()
      if (rank.length > 20) {
        await bot.sendMessage(chatId, "That seems too long for a rank. Try again (e.g. CPT, LTA, ME3, SGT).")
        return
      }
      reg.rank = rank
      reg.step = 'name'
      await bot.sendMessage(chatId, `And your name? (just your name, e.g. John Tan)`)
      return
    }
    if (reg.step === 'name') {
      const name = rawMessage.trim()
      if (name.length > 60) {
        await bot.sendMessage(chatId, "That seems too long for a name. Try again.")
        return
      }
      const existing = await prisma.officer.findUnique({ where: { telegramId } })
      if (existing) {
        pendingRegistration.delete(telegramId)
        await bot.sendMessage(chatId, `You're already registered, ${existing.name || existing.telegramName || 'there'}.`, { reply_markup: replyKeyboardMarkup() })
        return
      }
      pendingRegistration.delete(telegramId)
      const adminId = await getDefaultAdminId()
      await prisma.officer.create({
        data: {
          telegramId,
          telegramName: reg.telegramName,
          name: `${reg.rank} ${name}`,
          adminId,
        },
      })
      await bot.sendMessage(
        chatId,
        `Welcome, ${reg.rank} ${name}! You're all set.\n\nYap your status anytime — type 'in', 'mc', 'vl', etc. or tap the buttons below.`,
        { reply_markup: replyKeyboardMarkup() }
      )
      return
    }
  }

  // 1b. Reply Keyboard button taps (persistent bottom keyboard)
  // These come as plain text messages — detect and handle them before anything else
  if (rawMessage === '📋 Report Today') {
    const officerForReport = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForReport) { await startRegistration(telegramId, chatId, msg.from); return }
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, chatId, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(chatId, "What's your availability today? 👇", {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  if (rawMessage === '📅 Plan This Week') {
    const officerForWeek = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForWeek) { await startRegistration(telegramId, chatId, msg.from); return }
    await openWeekGrid(telegramId, chatId, false, todayISO)
    return
  }

  if (rawMessage === '📅 Plan Next Week') {
    const officerForWeek = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForWeek) { await startRegistration(telegramId, chatId, msg.from); return }
    await openWeekGrid(telegramId, chatId, true, todayISO)
    return
  }

  if (rawMessage === '📊 My Status') {
    const officerForStatus = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForStatus) { await startRegistration(telegramId, chatId, msg.from); return }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const avail = await prisma.availability.findFirst({
      where: { officerId: officerForStatus.id, date: today },
    })
    const name = officerForStatus.name || officerForStatus.telegramName || 'Officer'
    if (!avail) {
      await bot.sendMessage(chatId, `⚠️ ${name}, haven't reported today yet! Tap 📋 Report Today to log it 😄`, {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      await bot.sendMessage(chatId, `${name}'s status today: ${formatRecord(avail)}${avail.notes ? ` (${avail.notes})` : ''}`, {
        reply_markup: replyKeyboardMarkup(),
      })
    }
    return
  }

  // 2a. Active week session at text-input step
  if (weekSessions.has(telegramId)) {
    const weekSession = weekSessions.get(telegramId)

    if (weekSession.step === 'DAY_REASON_TEXT') {
      const date = weekSession.currentDay
      if (date) {
        weekSession.days[date] = { status: 'OUT', reason: rawMessage, notes: '', splitDay: false }
        weekSession.step = 'GRID'
        weekSession.currentDay = null
        const text = buildWeekGridText(weekSession)
        const reply_markup = buildWeekGridKeyboard(weekSession)
        await bot.editMessageText(text, {
          chat_id: weekSession.chatId,
          message_id: weekSession.messageId,
          reply_markup,
        })
      }
      return
    }

    if (weekSession.step === 'DAY_SPLIT_REASON_TEXT') {
      const date = weekSession.currentDay
      if (date) {
        const day = weekSession.days[date] || { splitDay: true, amStatus: 'IN', pmStatus: 'IN' }
        day.outReason = rawMessage
        day.reason = rawMessage
        const amIn = day.amStatus === 'IN'
        const pmIn = day.pmStatus === 'IN'
        day.status = amIn ? 'IN' : 'OUT'
        day.notes = `${amIn ? 'AM in' : `AM out (${rawMessage})`}, ${pmIn ? 'PM in' : `PM out (${rawMessage})`}`
        weekSession.days[date] = day
        weekSession.step = 'GRID'
        weekSession.currentDay = null
        const text = buildWeekGridText(weekSession)
        const reply_markup = buildWeekGridKeyboard(weekSession)
        await bot.editMessageText(text, {
          chat_id: weekSession.chatId,
          message_id: weekSession.messageId,
          reply_markup,
        })
      }
      return
    }

    // Any other text while week session is active — clear it and fall through
    weekSessions.delete(telegramId)
  }

  // 2. Check if officer exists in DB
  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await startRegistration(telegramId, chatId, msg.from)
    return
  }

  // 3. Active availability session at text-input step
  if (sessions.has(telegramId)) {
    const session = sessions.get(telegramId)

    if (session.step === 'REASON_TEXT') {
      session.reason = rawMessage
      session.step = 'DATE'
      const sent = await bot.sendMessage(chatId, `Got it — "${rawMessage}" 👍\n\nWhich date?`, {
        reply_markup: dateKeyboard(todayISO, tomorrowISO),
      })
      session.messageId = sent.message_id
      return
    }

    if (session.step === 'SPLIT_REASON_TEXT') {
      session.outReason = rawMessage
      session.step = 'DATE'
      const sent = await bot.sendMessage(chatId, `Got it — "${rawMessage}" 👍\n\nWhich date?`, {
        reply_markup: dateKeyboard(todayISO, tomorrowISO, true),
      })
      session.messageId = sent.message_id
      return
    }

    // Any other text while session is active — clear it and fall through
    sessions.delete(telegramId)
  }

  // 4. Keyword shortcut — fast path, no keyboard needed
  const matched = keywordMatch(rawMessage, todayISO, tomorrowISO)
  if (matched) {
    await storeAndConfirm(matched, officer, chatId, rawMessage)
    return
  }

  // 5. Default — show STATUS keyboard
  const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, chatId, messageId: null }
  sessions.set(telegramId, session)
  const sent = await bot.sendMessage(chatId, "What's your availability? 👇", {
    reply_markup: statusKeyboard(),
  })
  session.messageId = sent.message_id
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(query) {
  await bot.answerCallbackQuery(query.id)

  const telegramId = String(query.from.id)
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const data = query.data

  const todayISO = new Date().toISOString().split('T')[0]
  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Cancel
  if (data === 'cancel') {
    sessions.delete(telegramId)
    pendingRegistration.delete(telegramId)
    weekSessions.delete(telegramId)
    await bot.editMessageText('Cancelled! 😊 Say anything to start again.', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // ── Week planner callbacks ──
  if (data.startsWith('week_')) {
    const officerForWeek = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForWeek) {
      await bot.editMessageText("Eh you're not registered yet 😅 Say hi to start!", {
        chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
      })
      return
    }
    await handleWeekCallback(query, officerForWeek, telegramId, chatId, messageId, data, todayISO, tomorrowISO)
    return
  }

  // ── Availability callbacks — need an officer and session ──
  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await bot.editMessageText("Eh you're not registered yet 😅 Say hi to start!", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  const session = sessions.get(telegramId)
  if (!session) {
    await bot.editMessageText("This keyboard has expired 😅 Say anything to start again!", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  const colonIdx = data.indexOf(':')
  const type = data.slice(0, colonIdx)
  const value = data.slice(colonIdx + 1)

  if (type === 'status') {
    if (value === 'IN') {
      session.status = 'IN'
      session.step = 'DATE'
      await bot.editMessageText("You're IN ✅ — which date?", {
        chat_id: chatId, message_id: messageId,
        reply_markup: dateKeyboard(todayISO, tomorrowISO),
      })
    } else if (value === 'OUT') {
      session.status = 'OUT'
      session.step = 'REASON'
      await bot.editMessageText("You're OUT ❌ — what's the reason?", {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('reason'),
      })
    } else if (value === 'SPLIT') {
      session.splitDay = true
      session.step = 'AM_STATUS'
      await bot.editMessageText("Split day! What's your status in the morning? 🌅", {
        chat_id: chatId, message_id: messageId,
        reply_markup: amStatusKeyboard(),
      })
    }
    return
  }

  if (type === 'reason') {
    if (value === 'OTHER') {
      session.step = 'REASON_TEXT'
      await bot.editMessageText("What's the reason? Type it 👇", {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.reason = value
      session.step = 'DATE'
      await bot.editMessageText(`Out — ${value} ❌\n\nWhich date?`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: dateKeyboard(todayISO, tomorrowISO),
      })
    }
    return
  }

  if (type === 'am') {
    session.amStatus = value
    session.step = 'PM_STATUS'
    const amLabel = value === 'IN' ? '✅ In (Morning)' : '❌ Out (Morning)'
    await bot.editMessageText(`${amLabel}\n\nNow, afternoon? 🌆`, {
      chat_id: chatId, message_id: messageId,
      reply_markup: pmStatusKeyboard(),
    })
    return
  }

  if (type === 'pm') {
    session.pmStatus = value
    const needReason = session.amStatus === 'OUT' || value === 'OUT'
    if (needReason) {
      session.step = 'SPLIT_REASON'
      await bot.editMessageText("What's the reason for the out portion? 🤔", {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('splitreason'),
      })
    } else {
      // Both IN
      session.step = 'DATE'
      await bot.editMessageText("Both IN ✅ — which date?", {
        chat_id: chatId, message_id: messageId,
        reply_markup: dateKeyboard(todayISO, tomorrowISO, true),
      })
    }
    return
  }

  if (type === 'splitreason') {
    if (value === 'OTHER') {
      session.step = 'SPLIT_REASON_TEXT'
      await bot.editMessageText("What's the reason? Type it 👇", {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.outReason = value
      session.step = 'DATE'
      await bot.editMessageText(`Reason: ${value} — which date?`, {
        chat_id: chatId, message_id: messageId,
        reply_markup: dateKeyboard(todayISO, tomorrowISO, true),
      })
    }
    return
  }

  if (type === 'date') {
    const records = buildRecordsFromDateValue(value, session, todayISO, tomorrowISO)
    sessions.delete(telegramId)
    await storeAndConfirm(records, officer, chatId, null, messageId)
    return
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

async function handleCommand(msg) {
  const text = msg.text || ''
  const telegramId = String(msg.from.id)

  if (text.startsWith('/start')) {
    const existing = await prisma.officer.findUnique({ where: { telegramId } })
    if (existing) {
      const name = existing.name || existing.telegramName || 'there'
      await bot.sendMessage(
        msg.chat.id,
        `Hey ${name}, you're already registered.\n\nType 'in', 'mc', 'vl', etc. or tap the buttons to log your status.`,
        { reply_markup: replyKeyboardMarkup() }
      )
    } else {
      pendingRegistration.delete(telegramId)
      await startRegistration(telegramId, msg.chat.id, msg.from)
    }
    return
  }

  if (text.startsWith('/status')) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const officer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { availability: { where: { date: today }, take: 1 } },
    })

    if (!officer) {
      await bot.sendMessage(msg.chat.id, "Eh you're not registered leh 😅 Say hi first!")
      return
    }

    const avail = officer.availability[0]
    if (!avail) {
      await bot.sendMessage(msg.chat.id, "⚠️ Haven't reported today yet! Yap your status quick 😄", {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      const name = officer.name || officer.telegramName || 'Officer'
      await bot.sendMessage(msg.chat.id, `${name}'s status today: ${formatRecord(avail)}${avail.notes ? ` (${avail.notes})` : ''}`, {
        reply_markup: replyKeyboardMarkup(),
      })
    }
  }

  if (text.startsWith('/report')) {
    const todayISO = new Date().toISOString().split('T')[0]
    const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) {
      await bot.sendMessage(msg.chat.id, "Eh you're not registered leh 😅 Say hi first!")
      return
    }
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, chatId: msg.chat.id, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(msg.chat.id, "What's your availability today? 👇", {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
  }
}

async function nudgeOfficers(officers) {
  for (const officer of officers) {
    if (!officer.telegramId) continue
    const name = officer.name || officer.telegramName || 'there'
    try {
      await bot.sendMessage(
        officer.telegramId,
        `Morning ${name}, quick reminder to update your status before 0830. Just type 'in', 'mc', 'vl' or whatever applies.`
      )
    } catch (err) {
      console.error(`Nudge failed for officer ${officer.telegramId}:`, err.message)
    }
  }
}

module.exports = { bot, handleMessage, handleCommand, handleCallbackQuery, nudgeOfficers }
