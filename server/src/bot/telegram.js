const TelegramBot = require('node-telegram-bot-api')
const prisma = require('../config/prisma')
const { expandRecords, keywordMatch, multiDayMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput } = require('./parser')
const { normalizePhone } = require('../controllers/officers.controller')

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)

;(async () => {
  try {
    await bot.setMyCommands([
      { command: 'start',       description: 'Register or view your profile' },
      { command: 'roster',      description: "View today's attendance roster" },
      { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
      { command: 'deregister',  description: 'Remove your profile and attendance history' },
    ])
  } catch (e) {
    console.warn('[BOT] setMyCommands failed:', e.message)
  }
})()

function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Session stores ────────────────────────────────────────────────────────────
const sessions = new Map()
const weekSessions = new Map()
const pendingDeletion = new Set()

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
      { text: 'This Week', callback_data: 'date:thisweek' },
      { text: 'Next Week', callback_data: 'date:nextweek' },
    ])
  }
  keyboard.push([{ text: '❌  Cancel', callback_data: 'cancel' }])
  return { inline_keyboard: keyboard }
}

function replyKeyboardMarkup() {
  return {
    keyboard: [
      [{ text: '📋 Report Today' }, { text: '📊 My Status' }],
      [{ text: '📅 Plan This Week' }, { text: '📅 Plan Next Week' }],
      [{ text: 'View Roster' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  }
}

// ── Week grid utilities ───────────────────────────────────────────────────────

function getWeekDates(isNextWeek, todayISO) {
  if (isNextWeek) {
    const mon = getNextWeekMonday(todayISO)
    return [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  }
  const mon = getMondayOfWeek(todayISO)
  const allDays = [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  const remaining = allDays.filter(d => d >= todayISO)
  if (remaining.length === 0) {
    const nextMon = getNextWeekMonday(todayISO)
    return [0, 1, 2, 3, 4].map(i => addDays(nextMon, i))
  }
  return remaining
}

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

function buildWeekGridText(weekSession) {
  const first = weekSession.weekDates[0]
  const last = weekSession.weekDates[weekSession.weekDates.length - 1]
  const fmt = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()}`
  }
  return `${fmt(first)} – ${fmt(last)}\nTap a day to set your status.`
}

function buildWeekGridKeyboard(weekSession) {
  const { weekDates, days } = weekSession
  const row1 = weekDates.slice(0, 3).map(d => ({
    text: dayLabel(d, days),
    callback_data: `week_day:${d}`,
  }))
  const row2 = weekDates.slice(3).map(d => ({
    text: dayLabel(d, days),
    callback_data: `week_day:${d}`,
  }))

  const setDates = weekDates.filter(d => days[d])
  const unsetDates = weekDates.filter(d => !days[d])
  const setCount = setDates.length

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

async function openWeekGrid(telegramId, chatId, isNextWeek, todayISO) {
  const weekDates = getWeekDates(isNextWeek, todayISO)

  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  const existing = officer
    ? await prisma.availability.findMany({
        where: {
          officerId: officer.id,
          date: { in: weekDates.map(d => new Date(d)) },
        },
      })
    : []

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
    await bot.editMessageText("This keyboard has expired.", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  const refreshGrid = async () => {
    const text = buildWeekGridText(session)
    const reply_markup = buildWeekGridKeyboard(session)
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup })
  }

  if (data === 'week_cancel') {
    weekSessions.delete(telegramId)
    await bot.editMessageText('Cancelled.', {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  if (data === 'week_all_in') {
    const unsetDates = session.weekDates.filter(d => !session.days[d])
    for (const d of unsetDates) {
      session.days[d] = { status: 'IN', reason: null, notes: '', splitDay: false }
    }
    const records = session.weekDates
      .filter(d => session.days[d])
      .map(d => ({ ...session.days[d], date: d }))
    weekSessions.delete(telegramId)
    await storeAndConfirm(records, officer, chatId, 'week_all_in', messageId)
    return
  }

  if (data === 'week_confirm') {
    const records = session.weekDates
      .filter(d => session.days[d])
      .map(d => ({ ...session.days[d], date: d }))
    if (records.length === 0) {
      await bot.answerCallbackQuery(query.id, {
        text: "Select a day first.",
        show_alert: false,
      })
      return
    }
    weekSessions.delete(telegramId)
    await storeAndConfirm(records, officer, chatId, 'week_confirm', messageId)
    return
  }

  if (data.startsWith('week_day:')) {
    const date = data.slice(9)
    session.currentDay = date
    session.step = 'DAY_STATUS'

    const d = new Date(date)
    const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}`
    await bot.editMessageText(`${label} — status?`, {
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

  if (data === 'week_back') {
    session.step = 'GRID'
    session.currentDay = null
    await refreshGrid()
    return
  }

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
      await bot.editMessageText(`${label} — reason?`, {
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
      await bot.editMessageText(`${label} — morning status?`, {
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

  if (data.startsWith('week_reason:')) {
    const value = data.slice(12)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_REASON_TEXT'
      await bot.editMessageText("Type the reason.", {
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

  if (data.startsWith('week_am:')) {
    const value = data.slice(8)
    const date = session.currentDay
    if (!date) return

    if (!session.days[date]) session.days[date] = { status: 'IN', reason: null, notes: '', splitDay: true }
    session.days[date].amStatus = value
    session.step = 'DAY_SPLIT_PM'

    const d = new Date(date)
    const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
    const amLabel = value === 'IN' ? '✅ In (Morning)' : '❌ Out (Morning)'
    await bot.editMessageText(`${amLabel}. ${label} afternoon?`, {
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
      await bot.editMessageText(`${label} — reason for the out portion?`, {
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
      day.status = 'IN'
      day.reason = null
      day.notes = 'AM in, PM in'
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }

  if (data.startsWith('week_split_reason:')) {
    const value = data.slice(18)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_SPLIT_REASON_TEXT'
      await bot.editMessageText("Type the reason.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '← Back to week', callback_data: 'week_back' }]] },
      })
    } else {
      const day = session.days[date] || { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: 'IN', pmStatus: 'IN' }
      day.outReason = value
      day.reason = value
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
  const reasonStr = r.reason ? ` (${r.reason})` : ''
  if (r.notes && r.notes.includes('AM')) {
    const amHalf = r.notes.startsWith('AM in') ? '✅ IN' : `❌ OUT${reasonStr}`
    const pmHalf = r.notes.includes('PM in') ? '✅ IN' : `❌ OUT${reasonStr}`
    return `${amHalf} / ${pmHalf}`
  }
  if (r.status === 'IN') return '✅ IN'
  return `❌ OUT${reasonStr}`
}

function formatRecordPlain(r) {
  const reasonStr = r.reason ? ` (${r.reason})` : ''
  if (r.notes && r.notes.includes('AM')) {
    const amHalf = r.notes.startsWith('AM in') ? 'IN' : `OUT${reasonStr}`
    const pmHalf = r.notes.includes('PM in') ? 'IN' : `OUT${reasonStr}`
    return `${amHalf} / ${pmHalf}`
  }
  if (r.status === 'IN') return 'IN'
  return `OUT${reasonStr}`
}

function buildConfirmText(name, records) {
  const fmtDate = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
  }

  if (records.length > 1) {
    const lines = records.map(r => `${fmtDate(r.date)}  ${formatRecordPlain(r)}`)
    return `Done — ${records.length} days logged for ${name}.\n\n${lines.join('\n')}`
  }

  const r = records[0]
  if (!r) return `Done — logged for ${name}.`

  const dateStr = fmtDate(r.date)
  if (r.splitDay) {
    return `Done — split day logged for ${name}, ${dateStr}.`
  }
  if (r.status === 'IN') {
    return `Done — ${name} IN for ${dateStr}.`
  }
  const reason = r.reason ? ` (${r.reason})` : ''
  return `Done — ${name} OUT${reason} for ${dateStr}.`
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
        splitDay: !!record.splitDay,
      },
      create: {
        officerId: officer.id,
        date: new Date(record.date),
        status: record.status,
        reason: record.reason,
        rawMessage: rawMessage || '',
        notes: record.notes || null,
        splitDay: !!record.splitDay,
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

// ── Phone verification ────────────────────────────────────────────────────────

async function handleContactVerification(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id
  const contact = msg.contact

  // Anti-spoof: only accept the user's own contact
  if (String(contact.user_id) !== telegramId) {
    await bot.sendMessage(chatId, "Please share your own contact, not someone else's.")
    return
  }

  const phone = normalizePhone(contact.phone_number)

  const officer = await prisma.officer.findFirst({
    where: { phoneNumber: phone },
    include: { division: true },
  })

  if (!officer) {
    const masked = phone.length >= 4 ? 'XXXX' + phone.slice(-4) : '****'
    console.warn(`[VERIFY FAIL] phone=${masked} telegramId=${telegramId}`)
    await bot.sendMessage(
      chatId,
      "Your phone number isn't in the system. Contact your admin to get added.",
      { reply_markup: { remove_keyboard: true } }
    )
    return
  }

  if (officer.telegramId && officer.telegramId !== telegramId) {
    await bot.sendMessage(chatId, "This number is already linked to another account. Contact your admin.")
    return
  }

  await prisma.officer.update({
    where: { id: officer.id },
    data: {
      telegramId,
      telegramName: msg.from.username || msg.from.first_name || null,
    },
  })

  const name = officer.name || msg.from.first_name || 'there'
  const divInfo = officer.division?.name ? ` for ${officer.division.name}` : ''

  if (officer.role === 'NSF') {
    await bot.sendMessage(
      chatId,
      `Verified! Welcome, ${name}${divInfo}.\n\nYou're registered as NSF. Use /roster to view your division's roster.`,
      { reply_markup: { remove_keyboard: true } }
    )
  } else {
    await bot.sendMessage(
      chatId,
      `Verified! Welcome, ${name}${divInfo}.\n\nType in, mc, vl, wfh or use the buttons below.\nUse /roster to view the roster.`,
      { reply_markup: replyKeyboardMarkup() }
    )
  }
}

// ── Roster display ────────────────────────────────────────────────────────────

async function handleRosterCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true },
  })
  if (!officer) {
    await bot.sendMessage(chatId, "Not registered. Send /start to get started.")
    return
  }

  const todayISO = localISODate()
  const today = new Date(todayISO)

  // Only extract args when called from a /roster command (not from 'View Roster' button)
  const args = (msg.text || '').startsWith('/roster')
    ? (msg.text || '').replace(/^\/roster\s*/i, '').trim()
    : ''

  let targetDivisionName
  if (officer.role === 'NSF') {
    targetDivisionName = officer.division?.name || null
  } else if (args) {
    targetDivisionName = args
  } else {
    targetDivisionName = officer.division?.name || null
  }

  const where = {}
  if (targetDivisionName) {
    const div = await prisma.division.findFirst({
      where: { name: { contains: targetDivisionName, mode: 'insensitive' } },
    })
    if (!div) {
      await bot.sendMessage(chatId,
        `No division found matching "${targetDivisionName}".`,
        { reply_markup: replyKeyboardMarkup() }
      )
      return
    }
    where.divisionId = div.id
  }

  const officers = await prisma.officer.findMany({
    where,
    include: {
      availability: { where: { date: today }, take: 1 },
      branch: true,
      division: true,
    },
    orderBy: [{ name: 'asc' }],
  })

  if (officers.length === 0) {
    await bot.sendMessage(chatId, targetDivisionName
      ? `No officers found for ${targetDivisionName}.`
      : 'No officers found.',
      { reply_markup: replyKeyboardMarkup() }
    )
    return
  }

  let countIn = 0, countOut = 0, countNotReported = 0
  const reasonCounts = {}
  for (const o of officers) {
    const avail = o.availability[0]
    if (!avail) { countNotReported++; continue }
    if (avail.status === 'IN') { countIn++; continue }
    countOut++
    if (avail.reason) reasonCounts[avail.reason] = (reasonCounts[avail.reason] || 0) + 1
  }

  const reasonSummary = Object.entries(reasonCounts).map(([r, c]) => `${r}×${c}`).join(', ')
  const outStr = countOut > 0 && reasonSummary ? `OUT: ${countOut} (${reasonSummary})` : `OUT: ${countOut}`

  const d = new Date(todayISO)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()} (${dayNames[d.getDay()]})`
  const divLabel = targetDivisionName || 'All Divisions'

  let text = `📋 Roster — ${dateStr}\n${divLabel}\nIN: ${countIn} | ${outStr} | Not reported: ${countNotReported}\n`

  const branches = {}
  for (const o of officers) {
    const br = o.branch?.name || 'Unassigned'
    if (!branches[br]) branches[br] = []
    branches[br].push(o)
  }

  for (const [branchName, branchOfficers] of Object.entries(branches)) {
    text += `\n— ${branchName} —\n`
    for (const o of branchOfficers) {
      const displayName = o.name || o.telegramName || 'Unknown'
      const avail = o.availability[0]
      if (!avail) {
        text += `⚠️ ${displayName} — Not reported\n`
      } else if (avail.status === 'IN') {
        if (avail.notes && avail.notes.includes('AM')) {
          text += `↔️ ${displayName} — ${formatRecordPlain(avail)}\n`
        } else {
          text += `✅ ${displayName} — IN\n`
        }
      } else {
        const reasonStr = avail.reason ? ` (${avail.reason})` : ''
        text += `❌ ${displayName} — OUT${reasonStr}\n`
      }
    }
  }

  await bot.sendMessage(chatId, text, { reply_markup: replyKeyboardMarkup() })
}

async function handleWeekplanCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await bot.sendMessage(chatId, "Not registered. Send /start to get started.")
    return
  }

  if (officer.role === 'NSF') {
    await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster.")
    return
  }

  const todayISO = localISODate()
  const mon = getMondayOfWeek(todayISO)
  const weekDates = [0, 1, 2, 3, 4].map(i => addDays(mon, i))

  const records = await prisma.availability.findMany({
    where: {
      officerId: officer.id,
      date: { in: weekDates.map(d => new Date(d)) },
    },
  })

  const recordMap = {}
  for (const rec of records) {
    const iso = rec.date.toISOString().split('T')[0]
    recordMap[iso] = rec
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const fmtDate = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
  }

  const first = weekDates[0]
  const last = weekDates[4]
  let text = `📅 Your week — ${fmtDate(first)} – ${fmtDate(last)}\n\n`

  weekDates.forEach((date, i) => {
    const rec = recordMap[date]
    if (!rec) {
      text += `${dayNames[i]}: ⚠️ Not reported\n`
    } else {
      text += `${dayNames[i]}: ${formatRecord(rec)}\n`
    }
  })

  await bot.sendMessage(chatId, text, { reply_markup: replyKeyboardMarkup() })
}

// ── Security: private-chat guard ──────────────────────────────────────────────

function isPrivateChat(msg) {
  return msg.chat.type === 'private'
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(msg) {
  // Private chat only
  if (!isPrivateChat(msg)) {
    await bot.sendMessage(msg.chat.id, 'This bot only works in private chats.')
    return
  }

  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  // Handle contact sharing (phone verification)
  if (msg.contact) {
    await handleContactVerification(msg)
    return
  }

  const rawMessage = sanitizeInput(msg.text || '')
  if (!rawMessage) return

  const todayISO = localISODate()
  const tomorrowISO = localISODate(new Date(Date.now() + 86400000))

  // 0. Pending deletion confirmation
  if (pendingDeletion.has(telegramId)) {
    pendingDeletion.delete(telegramId)
    if (rawMessage === 'YES') {
      const officerToDelete = await prisma.officer.findUnique({ where: { telegramId } })
      if (officerToDelete) {
        await prisma.officer.delete({ where: { telegramId } })
        await bot.sendMessage(chatId, "Profile deleted. Re-register anytime with /start.", {
          reply_markup: { remove_keyboard: true },
        })
      } else {
        await bot.sendMessage(chatId, "No profile found.", { reply_markup: replyKeyboardMarkup() })
      }
    } else {
      await bot.sendMessage(chatId, "Deletion cancelled.", { reply_markup: replyKeyboardMarkup() })
    }
    return
  }

  // 0.5. Multi-day free-text
  const multiRecords = multiDayMatch(rawMessage, todayISO)
  if (multiRecords && multiRecords.length >= 2) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster."); return }
    const expanded = expandRecords(multiRecords, todayISO)
    await storeAndConfirm(expanded, officer, chatId, rawMessage, null)
    return
  }

  // 1. Reply Keyboard button taps
  if (rawMessage === '📋 Report Today') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster."); return }
    // Invalidate any existing session keyboard so old buttons can't be tapped
    const existingSession = sessions.get(telegramId)
    if (existingSession?.messageId) {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: existingSession.chatId, message_id: existingSession.messageId }
        )
      } catch (_) { /* already gone or already edited — ignore */ }
    }
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, reportToday: true, chatId, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(chatId, "Today's status?", {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  if (rawMessage === '📅 Plan This Week') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster."); return }
    await openWeekGrid(telegramId, chatId, false, todayISO)
    return
  }

  if (rawMessage === '📅 Plan Next Week') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster."); return }
    await openWeekGrid(telegramId, chatId, true, todayISO)
    return
  }

  if (rawMessage === '📊 My Status') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    const today = new Date(todayISO)
    const avail = await prisma.availability.findFirst({
      where: { officerId: officer.id, date: today },
    })
    const name = officer.name || officer.telegramName || 'Officer'
    const todayStr = (() => {
      const d = new Date(todayISO)
      return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
    })()
    if (!avail) {
      await bot.sendMessage(chatId, `No status logged today, ${name}.`, {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      const statusLine = formatRecord(avail)
      await bot.sendMessage(chatId, `${name} — ${todayStr}\n${statusLine}`, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Edit today\'s status', callback_data: 'edit_today' }]],
        },
      })
    }
    return
  }

  if (rawMessage === 'View Roster') {
    await handleRosterCommand(msg)
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

    weekSessions.delete(telegramId)
  }

  // 2. Check if officer exists in DB
  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await promptVerification(chatId)
    return
  }

  // NSF guard
  if (officer.role === 'NSF') {
    await bot.sendMessage(chatId, "NSFs can't log attendance. Use /roster to view the roster.", { reply_markup: replyKeyboardMarkup() })
    return
  }

  // 3. Active availability session at text-input step
  if (sessions.has(telegramId)) {
    const session = sessions.get(telegramId)

    if (session.step === 'REASON_TEXT') {
      session.reason = rawMessage
      if (session.reportToday) {
        const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
        sessions.delete(telegramId)
        await storeAndConfirm(records, officer, chatId, rawMessage, null)
      } else {
        session.step = 'DATE'
        const sent = await bot.sendMessage(chatId, `Reason noted. Which date?`, {
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
        session.messageId = sent.message_id
      }
      return
    }

    if (session.step === 'SPLIT_REASON_TEXT') {
      session.outReason = rawMessage
      const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
      sessions.delete(telegramId)
      await storeAndConfirm(records, officer, chatId, rawMessage, null)
      return
    }

    sessions.delete(telegramId)
  }

  // 4. Keyword shortcut
  const matched = keywordMatch(rawMessage, todayISO, tomorrowISO)
  if (matched) {
    await storeAndConfirm(matched, officer, chatId, rawMessage)
    return
  }

  // 5. Default — show STATUS keyboard
  const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, chatId, messageId: null }
  sessions.set(telegramId, session)
  const sent = await bot.sendMessage(chatId, "Today's status?", {
    reply_markup: statusKeyboard(),
  })
  session.messageId = sent.message_id
}

// ── Prompt verification ───────────────────────────────────────────────────────

async function promptVerification(chatId) {
  await bot.sendMessage(
    chatId,
    "Welcome to Yappd! To verify your identity, please share your phone number.",
    { reply_markup: contactKeyboard() }
  )
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(query) {
  await bot.answerCallbackQuery(query.id)

  // Private chat only
  if (query.message.chat.type !== 'private') return

  const telegramId = String(query.from.id)
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const data = query.data

  const todayISO = localISODate()
  const tomorrowISO = localISODate(new Date(Date.now() + 86400000))

  // Cancel
  if (data === 'cancel') {
    sessions.delete(telegramId)
    weekSessions.delete(telegramId)
    pendingDeletion.delete(telegramId)
    await bot.editMessageText('Cancelled.', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  // Edit today's status
  if (data === 'edit_today') {
    const officerForEdit = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForEdit) {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
      await promptVerification(chatId)
      return
    }
    if (officerForEdit.role === 'NSF') {
      await bot.editMessageText("NSFs can't log attendance.", {
        chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
      })
      return
    }
    sessions.delete(telegramId)
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, reportToday: true, chatId, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(chatId, "Change today's status?", {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  // Week planner callbacks
  if (data.startsWith('week_')) {
    const officerForWeek = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForWeek) {
      await bot.editMessageText("Not registered. Send /start to get started.", {
        chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
      })
      return
    }
    await handleWeekCallback(query, officerForWeek, telegramId, chatId, messageId, data, todayISO, tomorrowISO)
    return
  }

  // Availability callbacks
  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await bot.editMessageText("Not registered. Send /start to get started.", {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    })
    return
  }

  const session = sessions.get(telegramId)
  if (!session || (session.messageId && messageId !== session.messageId)) {
    await bot.editMessageText("This keyboard has expired.", {
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
      if (session.reportToday) {
        const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
        sessions.delete(telegramId)
        await storeAndConfirm(records, officer, chatId, null, messageId)
      } else {
        session.step = 'DATE'
        await bot.editMessageText("IN — which date?", {
          chat_id: chatId, message_id: messageId,
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
      }
    } else if (value === 'OUT') {
      session.status = 'OUT'
      session.step = 'REASON'
      await bot.editMessageText("OUT — reason?", {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('reason'),
      })
    } else if (value === 'SPLIT') {
      session.splitDay = true
      session.step = 'AM_STATUS'
      await bot.editMessageText("Split day. Morning status?", {
        chat_id: chatId, message_id: messageId,
        reply_markup: amStatusKeyboard(),
      })
    }
    return
  }

  if (type === 'reason') {
    if (value === 'OTHER') {
      session.step = 'REASON_TEXT'
      await bot.editMessageText("Type the reason.", {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '← Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.reason = value
      if (session.reportToday) {
        const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
        sessions.delete(telegramId)
        await storeAndConfirm(records, officer, chatId, null, messageId)
      } else {
        session.step = 'DATE'
        await bot.editMessageText(`OUT (${value}) — which date?`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
      }
    }
    return
  }

  if (type === 'am') {
    session.amStatus = value
    session.pmStatus = value === 'IN' ? 'OUT' : 'IN'
    session.step = 'SPLIT_REASON'
    const amLabel = value === 'IN' ? 'Morning IN, afternoon OUT.' : 'Morning OUT, afternoon IN.'
    await bot.editMessageText(`${amLabel} Reason for the out portion?`, {
      chat_id: chatId, message_id: messageId,
      reply_markup: reasonKeyboard('splitreason'),
    })
    return
  }

  if (type === 'splitreason') {
    if (value === 'OTHER') {
      session.step = 'SPLIT_REASON_TEXT'
      await bot.editMessageText("Type the reason.", {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '← Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.outReason = value
      const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
      sessions.delete(telegramId)
      await storeAndConfirm(records, officer, chatId, null, messageId)
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
  // Private chat only
  if (!isPrivateChat(msg)) {
    await bot.sendMessage(msg.chat.id, 'This bot only works in private chats.')
    return
  }

  const text = msg.text || ''
  const telegramId = String(msg.from.id)

  if (text.startsWith('/start')) {
    const existing = await prisma.officer.findUnique({
      where: { telegramId },
      include: { division: true },
    })
    if (existing) {
      const name = existing.name || existing.telegramName || 'there'
      const roleInfo = existing.role === 'NSF' ? ' (NSF)' : ''
      const divInfo = existing.division?.name ? ` — ${existing.division.name}` : ''
      await bot.sendMessage(
        msg.chat.id,
        `Registered as ${name}${roleInfo}${divInfo}.\n\n` +
        (existing.role === 'NSF'
          ? 'Commands:\n/roster — View your division\'s roster\n/weekplan — View this week\'s plan\n/deregister — Remove your profile'
          : 'Type in, mc, vl, wfh or use the buttons below.\n\nCommands:\n/roster — View the roster\n/weekplan — View your week plan\n/status — Check today\'s status\n/report — Report today\'s attendance\n/deregister — Remove your profile'),
        { reply_markup: existing.role === 'NSF' ? undefined : replyKeyboardMarkup() }
      )
    } else {
      await promptVerification(msg.chat.id)
    }
    return
  }

  if (text.startsWith('/roster')) {
    await handleRosterCommand(msg)
    return
  }

  if (text.startsWith('/weekplan')) {
    await handleWeekplanCommand(msg)
    return
  }

  if (text.startsWith('/status')) {
    const todayISO = localISODate()
    const today = new Date(todayISO)

    const officer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { availability: { where: { date: today }, take: 1 } },
    })

    if (!officer) {
      await bot.sendMessage(msg.chat.id, "Not registered. Send /start to get started.")
      return
    }

    const avail = officer.availability[0]
    if (!avail) {
      await bot.sendMessage(msg.chat.id, `No status logged today, ${officer.name || officer.telegramName || 'there'}.`, {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      const name = officer.name || officer.telegramName || 'Officer'
      const d = new Date(todayISO)
      const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.sendMessage(msg.chat.id, `${name} — ${dateStr}\n${formatRecord(avail)}`, {
        reply_markup: replyKeyboardMarkup(),
      })
    }
    return
  }

  if (text.startsWith('/report')) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) {
      await bot.sendMessage(msg.chat.id, "Not registered. Send /start to get started.")
      return
    }
    if (officer.role === 'NSF') {
      await bot.sendMessage(msg.chat.id, "NSFs can't log attendance. Use /roster to view the roster.")
      return
    }
    const todayISO = localISODate()
    const tomorrowISO = localISODate(new Date(Date.now() + 86400000))
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, pmStatus: null, outReason: null, chatId: msg.chat.id, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(msg.chat.id, "Today's status?", {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  if (text.startsWith('/deregister')) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) {
      await bot.sendMessage(msg.chat.id, "No profile found.", { reply_markup: replyKeyboardMarkup() })
      return
    }
    const displayName = officer.name || officer.telegramName || 'your profile'
    pendingDeletion.add(telegramId)
    await bot.sendMessage(
      msg.chat.id,
      `This will permanently delete *${displayName}* and all attendance history.\n\nType *YES* to confirm.`,
      { parse_mode: 'Markdown' }
    )
  }
}

async function nudgeOfficers(officers) {
  for (const officer of officers) {
    if (!officer.telegramId) continue
    if (officer.role === 'NSF') continue
    const name = officer.name || officer.telegramName || 'there'
    try {
      await bot.sendMessage(
        officer.telegramId,
        `Morning, ${name}. No status logged yet for today — update before 0830.\n\nType in, mc, vl or tap Report Today.`
      )
    } catch (err) {
      console.error(`Nudge failed for officer ${officer.telegramId}:`, err.message)
    }
  }
}

module.exports = { bot, handleMessage, handleCommand, handleCallbackQuery, nudgeOfficers }
