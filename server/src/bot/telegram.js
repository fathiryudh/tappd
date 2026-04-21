const TelegramBot = require('node-telegram-bot-api')
const prisma = require('../config/prisma')
const { expandRecords, keywordMatch, multiDayMatch, dateRangeMatch, cancelRangeMatch, getDayISO, addDays, getMondayOfWeek, getNextWeekMonday, sanitizeInput, parseSingleDate, expandWeekdays } = require('./parser')
const { normalizePhone } = require('../utils/phone')

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN)

if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    bot.setMyCommands([
      { command: 'start',       description: 'Register or view your profile' },
      { command: 'report',      description: 'Log attendance for today' },
      { command: 'status',      description: "Check today's attendance status" },
      { command: 'holiday',     description: 'Mark yourself OVL for a date range' },
      { command: 'roster',      description: "View today's attendance roster" },
      { command: 'editprofile', description: 'Edit your profile (name, rank, division, branch, phone)' },
      { command: 'deregister',  description: 'Remove your profile and attendance history' },
    ])
      .then(() => console.log('[BOT] setMyCommands registered successfully'))
      .catch(error => logBotError('setMyCommands', error))
  }, 1000)
}

function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isWeekend(isoDate) {
  const dow = new Date(isoDate + 'T00:00:00').getDay()
  return dow === 0 || dow === 6
}

function isSplitRecord(record) {
  return !!(record && record.notes && record.notes.includes('AM'))
}

function parseSplitNotes(notes = '') {
  const upper = String(notes)
  const amMatch = upper.match(/AM\s+(IN|OUT(?:\(([^)]+)\))?)/i)
  const pmMatch = upper.match(/PM\s+(IN|OUT(?:\(([^)]+)\))?)/i)

  const parseHalf = (match) => {
    if (!match) return { status: 'IN', reason: null }
    const token = match[1].toUpperCase()
    const reason = match[2] || null
    return {
      status: token.startsWith('OUT') ? 'OUT' : 'IN',
      reason,
    }
  }

  return {
    am: parseHalf(amMatch),
    pm: parseHalf(pmMatch),
  }
}

function formatSingleStatus(status, reason = null) {
  return status === 'IN' ? 'IN' : `OUT${reason ? `(${reason})` : ''}`
}

function buildSplitNotes(amStatus, amReason, pmStatus, pmReason) {
  return `AM ${formatSingleStatus(amStatus, amReason)} / PM ${formatSingleStatus(pmStatus, pmReason)}`
}

function buildSplitRecord(amStatus, amReason, pmStatus, pmReason) {
  return {
    status: amStatus,
    reason: amReason || pmReason || null,
    notes: buildSplitNotes(amStatus, amReason, pmStatus, pmReason),
    splitDay: true,
  }
}

function fmtDateShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
}

function isIgnorableReplyMarkupEditError(error) {
  const description = error?.response?.body?.description || error?.message || ''
  return (
    description.includes('message is not modified')
    || description.includes('message to edit not found')
    || description.includes('message can\'t be edited')
  )
}

function logBotError(context, error, details = {}) {
  const message = error?.response?.body?.description || error?.message || error
  const metadata = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
  const label = metadata ? `[BOT] ${context} failed (${metadata}):` : `[BOT] ${context} failed:`
  console.error(label, message)
}

const sessions = new Map()
const weekSessions = new Map()
const pendingDeletion = new Set()
const editSessions = new Map()
const holidaySessions = new Map()  // telegramId → { step: 'start'|'end'|'confirm', startDate, endDate, days }

function statusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'IN', callback_data: 'status:IN' },
        { text: 'OUT', callback_data: 'status:OUT' },
      ],
      [{ text: 'Split Day', callback_data: 'status:SPLIT' }],
      [{ text: 'Cancel', callback_data: 'cancel' }],
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
        { text: 'HQ', callback_data: `${p}:HQ` },
        { text: 'Family Emergency', callback_data: `${p}:Family Emergency` },
      ],
      [{ text: 'Other', callback_data: `${p}:OTHER` }],
      [{ text: 'Cancel', callback_data: 'cancel' }],
    ],
  }
}

function amStatusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'AM IN', callback_data: 'am:IN' },
        { text: 'AM OUT', callback_data: 'am:OUT' },
      ],
      [{ text: 'Cancel', callback_data: 'cancel' }],
    ],
  }
}

function pmStatusKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'PM IN', callback_data: 'pm:IN' },
        { text: 'PM OUT', callback_data: 'pm:OUT' },
      ],
      [{ text: 'Cancel', callback_data: 'cancel' }],
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
  keyboard.push([{ text: 'Cancel', callback_data: 'cancel' }])
  return { inline_keyboard: keyboard }
}

function replyKeyboardMarkup() {
  return {
    keyboard: [
      [{ text: 'Report Today' }, { text: 'My Status' }],
      [{ text: 'Plan This Week' }, { text: 'Plan Next Week' }],
      [{ text: 'View Roster' }, { text: 'Edit Profile' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

function contactKeyboard() {
  return {
    keyboard: [[{ text: 'Share Phone Number', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  }
}

function editProfileKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Name',     callback_data: 'edit_name' },
        { text: 'Rank',     callback_data: 'edit_rank' },
      ],
      [
        { text: 'Division', callback_data: 'edit_division' },
        { text: 'Branch',   callback_data: 'edit_branch' },
      ],
      [{ text: 'Phone', callback_data: 'edit_phone' }],
      [{ text: 'Done',  callback_data: 'edit_done'  }],
    ],
  }
}

function buildProfileText(officer) {
  const name     = officer.name           || '(not set)'
  const rank     = officer.rank           || '(not set)'
  const division = officer.division?.name || '(not set)'
  const branch   = officer.branch?.name   || '(not set)'
  const phone    = officer.phoneNumber    || '(not set)'
  return (
    `Profile\n\n` +
    `Name: ${name}\nRank: ${rank}\nDivision: ${division}\nBranch: ${branch}\nPhone: ${phone}\n\n` +
    `Choose a field to update.`
  )
}

async function divisionKeyboard() {
  const divisions = await prisma.division.findMany({ orderBy: { name: 'asc' } })
  const rows = divisions.map(d => [{ text: d.name, callback_data: `edit_div:${d.id}` }])
  rows.push([{ text: 'Other', callback_data: 'edit_division_other' }])
  rows.push([{ text: 'Cancel', callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}

async function branchKeyboard() {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } })
  const rows = branches.map(b => [{ text: b.name, callback_data: `edit_br:${b.id}` }])
  rows.push([{ text: 'Other', callback_data: 'edit_branch_other' }])
  rows.push([{ text: 'Cancel', callback_data: 'edit_cancel' }])
  return { inline_keyboard: rows }
}

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
  if (!entry) return `${name} ${num}`
  if (entry.splitDay) return `${name} ${num} SPLIT`
  if (entry.status === 'IN') return `${name} ${num} IN`
  const r = entry.reason ? entry.reason.slice(0, 4) : ''
  return `${name} ${num} OUT${r ? ` ${r}` : ''}`
}

function buildWeekGridText(weekSession) {
  const first = weekSession.weekDates[0]
  const last = weekSession.weekDates[weekSession.weekDates.length - 1]
  const fmt = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()}`
  }
  return `${fmt(first)} to ${fmt(last)}\nChoose a day to set status.`
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
    actionRow.push({ text: `Confirm (${setCount})`, callback_data: 'week_confirm' })
  }
  if (unsetDates.length > 0) {
    const allInLabel = setCount === 0 ? 'Set All In' : 'Set Remaining In'
    actionRow.push({ text: allInLabel, callback_data: 'week_all_in' })
  }

  const cancelRow = [{ text: 'Cancel', callback_data: 'week_cancel' }]

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
    await bot.editMessageText(`${label}\nChoose status.`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'IN', callback_data: 'week_status:IN' },
            { text: 'OUT', callback_data: 'week_status:OUT' },
            { text: 'Split Day', callback_data: 'week_status:SPLIT' },
          ],
          [{ text: 'Back', callback_data: 'week_back' }],
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
      await bot.editMessageText(`${label}\nChoose reason.`, {
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
              { text: 'HQ', callback_data: 'week_reason:HQ' },
              { text: 'Family Emergency', callback_data: 'week_reason:Family Emergency' },
            ],
            [{ text: 'Other', callback_data: 'week_reason:OTHER' }],
            [{ text: 'Back', callback_data: 'week_back' }],
          ],
        },
      })
    } else if (value === 'SPLIT') {
      session.step = 'DAY_SPLIT_AM'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      session.days[date] = { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: null, amReason: null, pmStatus: null, pmReason: null }
      await bot.editMessageText(`${label}\nChoose AM status.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'AM IN', callback_data: 'week_am:IN' },
              { text: 'AM OUT', callback_data: 'week_am:OUT' },
            ],
            [{ text: 'Back', callback_data: 'week_back' }],
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
      await bot.editMessageText("Type reason.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Back', callback_data: 'week_back' }]] },
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

    if (!session.days[date]) session.days[date] = { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: null, amReason: null, pmStatus: null, pmReason: null }
    session.days[date].amStatus = value
    session.days[date].amReason = null
    if (value === 'OUT') {
      session.step = 'DAY_SPLIT_AM_REASON'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label}\nChoose AM reason.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'MC', callback_data: 'week_split_am_reason:MC' },
              { text: 'VL', callback_data: 'week_split_am_reason:VL' },
              { text: 'OVL', callback_data: 'week_split_am_reason:OVL' },
              { text: 'OIL', callback_data: 'week_split_am_reason:OIL' },
            ],
            [
              { text: 'WFH', callback_data: 'week_split_am_reason:WFH' },
              { text: 'Course', callback_data: 'week_split_am_reason:Course' },
              { text: 'HQ', callback_data: 'week_split_am_reason:HQ' },
              { text: 'Family Emergency', callback_data: 'week_split_am_reason:Family Emergency' },
            ],
            [{ text: 'Other', callback_data: 'week_split_am_reason:OTHER' }],
            [{ text: 'Back', callback_data: 'week_back' }],
          ],
        },
      })
    } else {
      session.step = 'DAY_SPLIT_PM'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label}\nChoose PM status.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'PM IN', callback_data: 'week_pm:IN' },
              { text: 'PM OUT', callback_data: 'week_pm:OUT' },
            ],
            [{ text: 'Back', callback_data: 'week_back' }],
          ],
        },
      })
    }
    return
  }

  if (data.startsWith('week_split_am_reason:')) {
    const value = data.slice('week_split_am_reason:'.length)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_SPLIT_AM_REASON_TEXT'
      await bot.editMessageText("Type AM reason.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Back', callback_data: 'week_back' }]] },
      })
    } else {
      const day = session.days[date]
      day.amReason = value
      session.step = 'DAY_SPLIT_PM'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label}\nChoose PM status.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'PM IN', callback_data: 'week_pm:IN' },
              { text: 'PM OUT', callback_data: 'week_pm:OUT' },
            ],
            [{ text: 'Back', callback_data: 'week_back' }],
          ],
        },
      })
    }
    return
  }

  if (data.startsWith('week_pm:')) {
    const value = data.slice(8)
    const date = session.currentDay
    if (!date) return

    const day = session.days[date] || { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: null, amReason: null, pmStatus: null, pmReason: null }
    day.pmStatus = value
    day.pmReason = null
    session.days[date] = day

    if (value === 'OUT') {
      session.step = 'DAY_SPLIT_PM_REASON'
      const d = new Date(date)
      const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.editMessageText(`${label}\nChoose PM reason.`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'MC', callback_data: 'week_split_pm_reason:MC' },
              { text: 'VL', callback_data: 'week_split_pm_reason:VL' },
              { text: 'OVL', callback_data: 'week_split_pm_reason:OVL' },
              { text: 'OIL', callback_data: 'week_split_pm_reason:OIL' },
            ],
            [
              { text: 'WFH', callback_data: 'week_split_pm_reason:WFH' },
              { text: 'Course', callback_data: 'week_split_pm_reason:Course' },
              { text: 'HQ', callback_data: 'week_split_pm_reason:HQ' },
              { text: 'Family Emergency', callback_data: 'week_split_pm_reason:Family Emergency' },
            ],
            [{ text: 'Other', callback_data: 'week_split_pm_reason:OTHER' }],
            [{ text: 'Back', callback_data: 'week_back' }],
          ],
        },
      })
    } else {
      const splitRecord = buildSplitRecord(day.amStatus, day.amReason, day.pmStatus, day.pmReason)
      Object.assign(day, splitRecord)
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }

  if (data.startsWith('week_split_pm_reason:')) {
    const value = data.slice('week_split_pm_reason:'.length)
    const date = session.currentDay
    if (!date) return

    if (value === 'OTHER') {
      session.step = 'DAY_SPLIT_PM_REASON_TEXT'
      await bot.editMessageText("Type PM reason.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Back', callback_data: 'week_back' }]] },
      })
    } else {
      const day = session.days[date] || { status: 'IN', reason: null, notes: '', splitDay: true, amStatus: 'IN', amReason: null, pmStatus: 'IN', pmReason: null }
      day.pmReason = value
      Object.assign(day, buildSplitRecord(day.amStatus, day.amReason, day.pmStatus, day.pmReason))
      session.step = 'GRID'
      session.currentDay = null
      await refreshGrid()
    }
    return
  }
}

function formatRecord(r) {
  if (isSplitRecord(r)) {
    const split = parseSplitNotes(r.notes)
    return `${`AM ${formatSingleStatus(split.am.status, split.am.reason)}`} / ${`PM ${formatSingleStatus(split.pm.status, split.pm.reason)}`}`
  }
  return formatSingleStatus(r.status, r.reason)
}

function formatRecordPlain(r) {
  return formatRecord(r)
}

function buildConfirmText(name, records) {
  const fmtDate = iso => {
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
  }

  if (records.length > 1) {
    const lines = records.map(r => `${fmtDate(r.date)}  ${formatRecordPlain(r)}`)
    return `Saved ${records.length} days for ${name}.\n\n${lines.join('\n')}`
  }

  const r = records[0]
  if (!r) return `Saved for ${name}.`

  const dateStr = fmtDate(r.date)
  return `Saved for ${name} on ${dateStr}.\n${formatRecordPlain(r)}`
}

function buildNotificationText(officer, record) {
  const displayName = officer.name || officer.telegramName || 'Officer'
  const rankPrefix = officer.rank ? `${officer.rank} ` : ''
  const branchLabel = officer.branch?.name ? ` · ${officer.branch.name}` : ''
  const divisionLabel = officer.division?.name ? ` · ${officer.division.name}` : ''
  const eventDate = new Date(record.date)
  const dateLabel = `${eventDate.getDate()} ${eventDate.toLocaleDateString('en-SG', { month: 'short' })}`
  const statusLabel = formatRecordPlain(record)

  return {
    title: `${displayName} updated status`,
    message: `${rankPrefix}${displayName}${divisionLabel}${branchLabel} set ${dateLabel} to ${statusLabel}.`,
  }
}

function buildRecordsFromDateValue(value, session, todayISO, tomorrowISO) {
  let baseRecord
  if (session.splitDay) {
    baseRecord = buildSplitRecord(session.amStatus, session.amReason, session.pmStatus, session.pmReason)
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

    if (officer.adminId) {
      const { title, message } = buildNotificationText(officer, record)

      try {
        await prisma.notificationEvent.create({
          data: {
            adminId: officer.adminId,
            officerId: officer.id,
            title,
            message,
            eventDate: new Date(record.date),
          },
        })
      } catch (err) {
        logBotError('notification event create', err, {
          adminId: officer.adminId,
          officerId: officer.id,
          date: record.date,
        })
      }
    }
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

async function handleContactVerification(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id
  const contact = msg.contact

  if (String(contact.user_id) !== telegramId) {
    await bot.sendMessage(chatId, "Please share your own contact, not someone else's.")
    return
  }

  const editSession = editSessions.get(telegramId)
  if (editSession?.field === 'phone') {
    const phone = normalizePhone(contact.phone_number)

    const existing = await prisma.officer.findFirst({
      where: { phoneNumber: phone },
    })
    const currentOfficer = await prisma.officer.findUnique({
      where: { telegramId },
      include: { division: true, branch: true },
    })

    if (!currentOfficer) {
      editSessions.delete(telegramId)
      await bot.sendMessage(chatId, "Your profile no longer exists. Please /start to re-register.", {
        reply_markup: { remove_keyboard: true },
      })
      return
    }
    if (existing && existing.id !== currentOfficer.id) {
      await bot.sendMessage(chatId, "That number is already linked to another account. No changes made.")
      return
    }

    await prisma.officer.update({ where: { telegramId }, data: { phoneNumber: phone } })
    await bot.sendMessage(chatId, 'Phone updated.', { reply_markup: { remove_keyboard: true } })

    editSession.field = null
    const updated = await prisma.officer.findUnique({
      where: { telegramId },
      include: { division: true, branch: true },
    })
    await bot.editMessageText(`Saved.\n\n${buildProfileText(updated)}`, {
      chat_id: chatId,
      message_id: editSession.messageId,
      reply_markup: editProfileKeyboard(),
    })
    return
  }

  const phone = normalizePhone(contact.phone_number)

  const officer = await prisma.officer.findFirst({
    where: { phoneNumber: phone },
    include: { division: true, branch: true },
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
      `Verified.\nWelcome ${name}${divInfo}.\n\nYou are registered as NSF.\nUse /roster to view your division roster.`,
      { reply_markup: { remove_keyboard: true } }
    )
  } else {
    await bot.sendMessage(
      chatId,
      `Verified.\nWelcome ${name}${divInfo}.\n\nType in, mc, vl, wfh or use the buttons below.\nUse /roster to view the roster.`,
      { reply_markup: replyKeyboardMarkup() }
    )
  }
}

async function handleEditProfileCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true, branch: true },
  })
  if (!officer) {
    await promptVerification(chatId)
    return
  }

  editSessions.delete(telegramId)

  const sent = await bot.sendMessage(chatId, buildProfileText(officer), {
    reply_markup: editProfileKeyboard(),
  })
  editSessions.set(telegramId, { field: null, messageId: sent.message_id, chatId })
}

async function handleRosterCommand(msg) {
  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  const officer = await prisma.officer.findUnique({
    where: { telegramId },
    include: { division: true, branch: true },
  })
  if (!officer) {
    await bot.sendMessage(chatId, "Not registered. Send /start to get started.")
    return
  }

  const todayISO = localISODate()
  const today = new Date(todayISO)

  const msgText = msg.text || ''
  const args = msgText.startsWith('/roster')
    ? msgText.replace(/^\/roster\s*/i, '').trim()
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
    const allDivisions = await prisma.division.findMany()
    const div = allDivisions.find(
      d => d.name.toLowerCase().includes(targetDivisionName.toLowerCase())
    )
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

  const reasonSummary = Object.entries(reasonCounts).map(([r, c]) => `${r} ${c}`).join(', ')
  const outStr = countOut > 0 && reasonSummary ? `OUT ${countOut} (${reasonSummary})` : `OUT ${countOut}`

  const d = new Date(todayISO)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })} ${d.getFullYear()} (${dayNames[d.getDay()]})`
  const divLabel = targetDivisionName || 'All Divisions'

  let text = `Roster\n${dateStr}\n${divLabel}\nIN ${countIn}\n${outStr}\nNot reported ${countNotReported}\n`

  const branches = {}
  for (const o of officers) {
    const br = o.branch?.name || 'Unassigned'
    if (!branches[br]) branches[br] = []
    branches[br].push(o)
  }

  for (const [branchName, branchOfficers] of Object.entries(branches)) {
    text += `\n${branchName}\n`
    for (const o of branchOfficers) {
      const displayName = o.name || o.telegramName || 'Unknown'
      const avail = o.availability[0]
      if (!avail) {
        text += `${displayName}: Not reported\n`
      } else if (isSplitRecord(avail)) {
        text += `${displayName}: ${formatRecordPlain(avail)}\n`
      } else if (avail.status === 'IN') {
        text += `${displayName}: IN\n`
      } else {
        const reasonStr = avail.reason ? ` (${avail.reason})` : ''
        text += `${displayName}: OUT${reasonStr}\n`
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
    await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.')
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
  let text = `Your week\n${fmtDate(first)} to ${fmtDate(last)}\n\n`

  weekDates.forEach((date, i) => {
    const rec = recordMap[date]
    if (!rec) {
      text += `${dayNames[i]}: Not reported\n`
    } else {
      text += `${dayNames[i]}: ${formatRecord(rec)}\n`
    }
  })

  await bot.sendMessage(chatId, text, { reply_markup: replyKeyboardMarkup() })
}

function isPrivateChat(msg) {
  return msg.chat.type === 'private'
}

async function handleHolidaySession(telegramId, chatId, rawMessage, todayISO) {
  const session = holidaySessions.get(telegramId)
  if (!session) return false

  if (rawMessage.startsWith('/')) {
    holidaySessions.delete(telegramId)
    return false // let the command handler process it
  }

  if (session.step === 'start') {
    const startISO = parseSingleDate(rawMessage, todayISO)
    if (!startISO) {
      await bot.sendMessage(chatId, "Couldn't read that date — try 21/4 or 21 Apr", {})
      return true
    }
    session.startDate = startISO
    session.step = 'end'
    await bot.sendMessage(chatId, 'What is your end date? (e.g. 30/4 or 30 Apr)', {
      reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'holiday:cancel' }]] },
    })
    return true
  }

  if (session.step === 'end') {
    const endISO = parseSingleDate(rawMessage, todayISO)
    if (!endISO) {
      await bot.sendMessage(chatId, "Couldn't read that date — try 30/4 or 30 Apr")
      return true
    }
    if (endISO < session.startDate) {
      await bot.sendMessage(chatId, 'End date must be after start date. What is your end date?', {})
      return true
    }
    const days = expandWeekdays(session.startDate, endISO)
    if (days === null) {
      await bot.sendMessage(chatId, "That's over 60 working days — please check your dates. What is your end date?")
      return true
    }
    if (days.length === 0) {
      await bot.sendMessage(chatId, 'No working days in that range. Please try different dates.')
      return true
    }
    session.endDate = endISO
    session.days = days
    session.step = 'confirm'
    const n = days.length
    const startFmt = fmtDateShort(session.startDate)
    const endFmt = fmtDateShort(endISO)
    await bot.sendMessage(
      chatId,
      `This will mark you OUT (OVL) for ${n} working day${n !== 1 ? 's' : ''} from ${startFmt} – ${endFmt}. Confirm?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Yes, confirm', callback_data: 'holiday:confirm' },
            { text: 'Cancel', callback_data: 'holiday:cancel' },
          ]],
        },
      }
    )
    return true
  }

  if (session.step === 'confirm') {
    await bot.sendMessage(chatId, 'Please tap Yes, confirm or Cancel above.')
    return true
  }

  return true
}

async function handleMessage(msg) {
  if (!isPrivateChat(msg)) {
    await bot.sendMessage(msg.chat.id, 'This bot only works in private chats.')
    return
  }

  const telegramId = String(msg.from.id)
  const chatId = msg.chat.id

  if (msg.contact) {
    await handleContactVerification(msg)
    return
  }

  const rawMessage = sanitizeInput(msg.text || '')

  const todayISO = localISODate()
  const tomorrowISO = localISODate(new Date(Date.now() + 86400000))

  if (editSessions.has(telegramId) && !msg.contact) {
    const editSession = editSessions.get(telegramId)
    const textFields = ['name', 'rank', 'division_other', 'branch_other']
    if (textFields.includes(editSession.field)) {
      const value = rawMessage.trim()

      if (!value) {
        await bot.sendMessage(chatId, 'Cannot be empty. Try again.')
        return
      }

      const maxLen = editSession.field === 'rank' ? 20 : 60
      if (value.length > maxLen) {
        await bot.sendMessage(chatId, `Too long. Max ${maxLen} characters.`)
        return
      }

      const field = editSession.field

      if (field === 'division_other') {
        const division = await prisma.division.upsert({
          where: { name: value },
          create: { name: value },
          update: {},
        })
        await prisma.officer.update({ where: { telegramId }, data: { divisionId: division.id } })
      } else if (field === 'branch_other') {
        const branch = await prisma.branch.upsert({
          where: { name: value },
          create: { name: value },
          update: {},
        })
        await prisma.officer.update({ where: { telegramId }, data: { branchId: branch.id } })
      } else {
        await prisma.officer.update({ where: { telegramId }, data: { [field]: value } })
      }

      editSession.field = null
      const updatedOfficer = await prisma.officer.findUnique({
        where: { telegramId },
        include: { division: true, branch: true },
      })
      await bot.editMessageText(`Saved.\n\n${buildProfileText(updatedOfficer)}`, {
        chat_id: chatId,
        message_id: editSession.messageId,
        reply_markup: editProfileKeyboard(),
      })
      return
    }
  }

  if (!rawMessage) return

  if (holidaySessions.has(telegramId)) {
    const handled = await handleHolidaySession(telegramId, chatId, rawMessage, todayISO)
    if (handled) return
  }

  if (pendingDeletion.has(telegramId)) {
    pendingDeletion.delete(telegramId)
    if (rawMessage.toUpperCase() === 'YES') {
      const officerToDelete = await prisma.officer.findUnique({ where: { telegramId } })
      if (officerToDelete) {
        await prisma.officer.delete({ where: { telegramId } })
        await bot.sendMessage(chatId, 'Profile deleted. Use /start to register again.', {
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

  const cancelDays = cancelRangeMatch(rawMessage, todayISO)
  if (cancelDays) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    await prisma.availability.deleteMany({
      where: {
        officerId: officer.id,
        date: { in: cancelDays.map(d => new Date(d)) },
      },
    })
    const n = cancelDays.length
    const startFmt = fmtDateShort(cancelDays[0])
    const endFmt = fmtDateShort(cancelDays[cancelDays.length - 1])
    await bot.sendMessage(
      chatId,
      `Cancelled ${n} day${n !== 1 ? 's' : ''} of leave (${startFmt} – ${endFmt}). Those days are now unconfirmed.`,
      { reply_markup: replyKeyboardMarkup() }
    )
    return
  }

  const rangeRecords = dateRangeMatch(rawMessage, todayISO)
  if (rangeRecords) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    await storeAndConfirm(rangeRecords, officer, chatId, rawMessage, null)
    return
  }

  const multiRecords = multiDayMatch(rawMessage, todayISO)
  if (multiRecords && multiRecords.length >= 2) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    const expanded = expandRecords(multiRecords, todayISO)
    await storeAndConfirm(expanded, officer, chatId, rawMessage, null)
    return
  }

  if (rawMessage === 'Report Today' || rawMessage === '📋 Report Today') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    if (isWeekend(todayISO)) {
      await bot.sendMessage(chatId,
        "It's the weekend — no need to report today.\nUse Plan Next Week to set your status for next week.",
        { reply_markup: replyKeyboardMarkup() }
      )
      return
    }
    const existingSession = sessions.get(telegramId)
    if (existingSession?.messageId) {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: existingSession.chatId, message_id: existingSession.messageId }
        )
      } catch (err) {
        if (!isIgnorableReplyMarkupEditError(err)) throw err
      }
    }
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, amReason: null, pmStatus: null, pmReason: null, reportToday: true, chatId, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(chatId, 'Choose today status.', {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  if (rawMessage === 'Plan This Week' || rawMessage === '📅 Plan This Week') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    await openWeekGrid(telegramId, chatId, false, todayISO)
    return
  }

  if (rawMessage === 'Plan Next Week' || rawMessage === '📅 Plan Next Week') {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) { await promptVerification(chatId); return }
    if (officer.role === 'NSF') { await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.'); return }
    await openWeekGrid(telegramId, chatId, true, todayISO)
    return
  }

  if (rawMessage === 'My Status' || rawMessage === '📊 My Status') {
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
      await bot.sendMessage(chatId, `No status logged today for ${name}.`, {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      const statusLine = formatRecord(avail)
      await bot.sendMessage(chatId, `${name}\n${todayStr}\n${statusLine}`, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Edit Today', callback_data: 'edit_today' }]],
        },
      })
    }
    return
  }

  if (rawMessage === 'View Roster') {
    await handleRosterCommand(msg)
    return
  }

  if (rawMessage === 'Edit Profile') {
    await handleEditProfileCommand(msg)
    return
  }

  if (weekSessions.has(telegramId)) {
    const weekSession = weekSessions.get(telegramId)

    if (weekSession.step === 'DAY_REASON_TEXT') {
      const date = weekSession.currentDay
      if (date) {
        weekSession.days[date] = { status: 'OUT', reason: rawMessage.toUpperCase(), notes: '', splitDay: false }
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

    if (weekSession.step === 'DAY_SPLIT_AM_REASON_TEXT') {
      const date = weekSession.currentDay
      if (date) {
        const day = weekSession.days[date] || { splitDay: true, amStatus: 'IN', amReason: null, pmStatus: null, pmReason: null }
        day.amReason = rawMessage.toUpperCase()
        weekSession.days[date] = day
        weekSession.step = 'DAY_SPLIT_PM'
        const d = new Date(date)
        const label = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
        await bot.editMessageText(`${label}\nChoose PM status.`, {
          chat_id: weekSession.chatId,
          message_id: weekSession.messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'PM IN', callback_data: 'week_pm:IN' },
                { text: 'PM OUT', callback_data: 'week_pm:OUT' },
              ],
              [{ text: 'Back', callback_data: 'week_back' }],
            ],
          },
        })
      }
      return
    }

    if (weekSession.step === 'DAY_SPLIT_PM_REASON_TEXT') {
      const date = weekSession.currentDay
      if (date) {
        const day = weekSession.days[date] || { splitDay: true, amStatus: 'IN', amReason: null, pmStatus: 'IN', pmReason: null }
        day.pmReason = rawMessage.toUpperCase()
        Object.assign(day, buildSplitRecord(day.amStatus, day.amReason, day.pmStatus, day.pmReason))
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

  const officer = await prisma.officer.findUnique({ where: { telegramId } })
  if (!officer) {
    await promptVerification(chatId)
    return
  }

  if (officer.role === 'NSF') {
    await bot.sendMessage(chatId, 'NSFs cannot log attendance. Use /roster to view the roster.', { reply_markup: replyKeyboardMarkup() })
    return
  }

  if (sessions.has(telegramId)) {
    const session = sessions.get(telegramId)

    if (session.step === 'REASON_TEXT') {
      session.reason = rawMessage.toUpperCase()
      if (session.reportToday) {
        const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
        sessions.delete(telegramId)
        await storeAndConfirm(records, officer, chatId, rawMessage, null)
      } else {
        session.step = 'DATE'
        const sent = await bot.sendMessage(chatId, 'Reason saved. Choose date.', {
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
        session.messageId = sent.message_id
      }
      return
    }

    if (session.step === 'AM_REASON_TEXT') {
      session.amReason = rawMessage.toUpperCase()
      session.step = 'PM_STATUS'
      const sent = await bot.sendMessage(chatId, 'Choose PM status.', {
        reply_markup: pmStatusKeyboard(),
      })
      session.messageId = sent.message_id
      return
    }

    if (session.step === 'PM_REASON_TEXT') {
      session.pmReason = rawMessage.toUpperCase()
      const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
      sessions.delete(telegramId)
      await storeAndConfirm(records, officer, chatId, rawMessage, null)
      return
    }

    sessions.delete(telegramId)
  }

  const matched = keywordMatch(rawMessage, todayISO, tomorrowISO)
  if (matched) {
    const allWeekend = matched.every(r => isWeekend(r.date))
    if (allWeekend) {
      await bot.sendMessage(chatId,
        "It's the weekend — no need to report.\nUse Plan Next Week to plan ahead.",
        { reply_markup: replyKeyboardMarkup() }
      )
      return
    }
    await storeAndConfirm(matched, officer, chatId, rawMessage)
    return
  }

  const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, amReason: null, pmStatus: null, pmReason: null, chatId, messageId: null }
  sessions.set(telegramId, session)
  const sent = await bot.sendMessage(chatId, 'Choose today status.', {
      reply_markup: statusKeyboard(),
  })
  session.messageId = sent.message_id
}

async function promptVerification(chatId) {
  await bot.sendMessage(
    chatId,
    "Welcome to Tappd! To verify your identity, please share your phone number.",
    { reply_markup: contactKeyboard() }
  )
}

async function handleCallbackQuery(query) {
  await bot.answerCallbackQuery(query.id)

  if (query.message.chat.type !== 'private') return

  const telegramId = String(query.from.id)
  const chatId = query.message.chat.id
  const messageId = query.message.message_id
  const data = query.data

  const todayISO = localISODate()
  const tomorrowISO = localISODate(new Date(Date.now() + 86400000))

  if (data === 'cancel' || data === 'holiday:cancel') {
    sessions.delete(telegramId)
    weekSessions.delete(telegramId)
    pendingDeletion.delete(telegramId)
    holidaySessions.delete(telegramId)
    await bot.editMessageText('Cancelled.', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  if (data === 'holiday:confirm') {
    const holidaySession = holidaySessions.get(telegramId)
    if (!holidaySession || holidaySession.step !== 'confirm') return
    holidaySessions.delete(telegramId)
    const officerForHoliday = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForHoliday) {
      await bot.sendMessage(chatId, 'Profile not found — send /start to register.', { reply_markup: replyKeyboardMarkup() })
      return
    }
    const records = holidaySession.days.map(date => ({ date, status: 'OUT', reason: 'OVL', notes: '' }))
    await storeAndConfirm(records, officerForHoliday, chatId, 'holiday_confirm', null)
    return
  }

  if (data === 'edit_today') {
    const officerForEdit = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officerForEdit) {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
      await promptVerification(chatId)
      return
    }
    if (officerForEdit.role === 'NSF') {
      await bot.editMessageText('NSFs cannot log attendance.', {
        chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
      })
      return
    }
    sessions.delete(telegramId)
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, amReason: null, pmStatus: null, pmReason: null, reportToday: true, chatId, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(chatId, 'Choose today status.', {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

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

  if (data.startsWith('edit_')) {
    const editSession = editSessions.get(telegramId)

    if (data === 'edit_done') {
      editSessions.delete(telegramId)
      const savedOfficer = await prisma.officer.findUnique({
        where: { telegramId },
        include: { division: true, branch: true },
      })
      await bot.editMessageText(
        buildProfileText(savedOfficer) + '\n\nSaved.',
        { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }
      )
      return
    }

    if (data === 'edit_cancel') {
      if (!editSession) {
        await bot.editMessageText('This keyboard has expired.', {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [] },
        })
        return
      }
      const prevField = editSession.field
      editSession.field = null
      if (prevField === 'phone') {
        await bot.sendMessage(chatId, 'Cancelled.', { reply_markup: { remove_keyboard: true } })
      }
      const officerForProfile = await prisma.officer.findUnique({
        where: { telegramId },
        include: { division: true, branch: true },
      })
      await bot.editMessageText(buildProfileText(officerForProfile), {
        chat_id: chatId, message_id: editSession.messageId,
        reply_markup: editProfileKeyboard(),
      })
      return
    }

    if (!editSession || editSession.messageId !== messageId) {
      await bot.editMessageText('This keyboard has expired.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      })
      return
    }

    if (data === 'edit_name') {
      editSession.field = 'name'
      await bot.editMessageText('Type your new name.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'edit_cancel' }]] },
      })
      return
    }

    if (data === 'edit_rank') {
      editSession.field = 'rank'
      await bot.editMessageText('Type your new rank.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'edit_cancel' }]] },
      })
      return
    }

    if (data === 'edit_division') {
      editSession.field = 'division'
      await bot.editMessageText('Choose your division:', {
        chat_id: chatId, message_id: messageId,
        reply_markup: await divisionKeyboard(),
      })
      return
    }

    if (data.startsWith('edit_div:')) {
      const divId = data.slice('edit_div:'.length)
      await prisma.officer.update({ where: { telegramId }, data: { divisionId: divId } })
      editSession.field = null
      const officerAfterDiv = await prisma.officer.findUnique({
        where: { telegramId }, include: { division: true, branch: true },
      })
      await bot.editMessageText(buildProfileText(officerAfterDiv), {
        chat_id: chatId, message_id: editSession.messageId,
        reply_markup: editProfileKeyboard(),
      })
      return
    }

    if (data === 'edit_division_other') {
      editSession.field = 'division_other'
      await bot.editMessageText('Type your division name:', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'edit_cancel' }]] },
      })
      return
    }

    if (data === 'edit_branch') {
      editSession.field = 'branch'
      await bot.editMessageText('Choose your branch or type a new one:', {
        chat_id: chatId, message_id: messageId,
        reply_markup: await branchKeyboard(),
      })
      return
    }

    if (data.startsWith('edit_br:')) {
      const brId = data.slice('edit_br:'.length)
      await prisma.officer.update({ where: { telegramId }, data: { branchId: brId } })
      editSession.field = null
      const officerAfterBr = await prisma.officer.findUnique({
        where: { telegramId }, include: { division: true, branch: true },
      })
      await bot.editMessageText(buildProfileText(officerAfterBr), {
        chat_id: chatId, message_id: editSession.messageId,
        reply_markup: editProfileKeyboard(),
      })
      return
    }

    if (data === 'edit_branch_other') {
      editSession.field = 'branch_other'
      await bot.editMessageText('Type your branch name:', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'edit_cancel' }]] },
      })
      return
    }

    if (data === 'edit_phone') {
      editSession.field = 'phone'
      await bot.editMessageText('Share your new phone number to update it.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'edit_cancel' }]] },
      })
      await bot.sendMessage(chatId, 'Use the button below to share your number.', {
        reply_markup: contactKeyboard(),
      })
      return
    }

    return
  }

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
        await bot.editMessageText('Choose date for IN.', {
          chat_id: chatId, message_id: messageId,
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
      }
    } else if (value === 'OUT') {
      session.status = 'OUT'
      session.step = 'REASON'
      await bot.editMessageText('Choose OUT reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('reason'),
      })
    } else if (value === 'SPLIT') {
      session.splitDay = true
      session.step = 'AM_STATUS'
      await bot.editMessageText('Choose AM status.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: amStatusKeyboard(),
      })
    }
    return
  }

  if (type === 'reason') {
    if (value === 'OTHER') {
      session.step = 'REASON_TEXT'
      await bot.editMessageText('Type reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.reason = value
      if (session.reportToday) {
        const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
        sessions.delete(telegramId)
        await storeAndConfirm(records, officer, chatId, null, messageId)
      } else {
        session.step = 'DATE'
        await bot.editMessageText(`Choose date for OUT(${value}).`, {
          chat_id: chatId, message_id: messageId,
          reply_markup: dateKeyboard(todayISO, tomorrowISO),
        })
      }
    }
    return
  }

  if (type === 'am') {
    session.amStatus = value
    session.amReason = null
    if (value === 'OUT') {
      session.step = 'AM_REASON'
      await bot.editMessageText('Choose AM reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('amreason'),
      })
    } else {
      session.step = 'PM_STATUS'
      await bot.editMessageText('Choose PM status.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: pmStatusKeyboard(),
      })
    }
    return
  }

  if (type === 'amreason') {
    if (value === 'OTHER') {
      session.step = 'AM_REASON_TEXT'
      await bot.editMessageText('Type AM reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.amReason = value
      session.step = 'PM_STATUS'
      await bot.editMessageText('Choose PM status.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: pmStatusKeyboard(),
      })
    }
    return
  }

  if (type === 'pm') {
    session.pmStatus = value
    session.pmReason = null
    if (value === 'OUT') {
      session.step = 'PM_REASON'
      await bot.editMessageText('Choose PM reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: reasonKeyboard('pmreason'),
      })
    } else {
      const records = buildRecordsFromDateValue('today', session, todayISO, tomorrowISO)
      sessions.delete(telegramId)
      await storeAndConfirm(records, officer, chatId, null, messageId)
    }
    return
  }

  if (type === 'pmreason') {
    if (value === 'OTHER') {
      session.step = 'PM_REASON_TEXT'
      await bot.editMessageText('Type PM reason.', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]] },
      })
    } else {
      session.pmReason = value
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

async function handleCommand(msg) {
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
      const divInfo = existing.division?.name ? `\nDivision: ${existing.division.name}` : ''
      await bot.sendMessage(
        msg.chat.id,
        `Registered as ${name}${roleInfo}.${divInfo}\n\n` +
        (existing.role === 'NSF'
          ? 'Commands\n/roster View your division roster\n/weekplan View this week plan\n/deregister Remove your profile'
          : 'Type in, mc, vl, wfh or use the buttons below.\n\nCommands\n/roster View the roster\n/weekplan View your week plan\n/status Check today status\n/report Report today attendance\n/deregister Remove your profile'),
        { reply_markup: existing.role === 'NSF' ? undefined : replyKeyboardMarkup() }
      )
    } else {
      await promptVerification(msg.chat.id)
    }
    holidaySessions.delete(telegramId)
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
      await bot.sendMessage(msg.chat.id, `No status logged today for ${officer.name || officer.telegramName || 'there'}.`, {
        reply_markup: replyKeyboardMarkup(),
      })
    } else {
      const name = officer.name || officer.telegramName || 'Officer'
      const d = new Date(todayISO)
      const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-SG', { month: 'short' })}`
      await bot.sendMessage(msg.chat.id, `${name}\n${dateStr}\n${formatRecord(avail)}`, {
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
      await bot.sendMessage(msg.chat.id, 'NSFs cannot log attendance. Use /roster to view the roster.')
      return
    }
    const todayISO = localISODate()
    const tomorrowISO = localISODate(new Date(Date.now() + 86400000))
    if (isWeekend(todayISO)) {
      await bot.sendMessage(msg.chat.id, "It's the weekend — no need to report today.")
      return
    }
    const session = { step: 'STATUS', status: null, reason: null, splitDay: false, amStatus: null, amReason: null, pmStatus: null, pmReason: null, chatId: msg.chat.id, messageId: null }
    sessions.set(telegramId, session)
    const sent = await bot.sendMessage(msg.chat.id, 'Choose today status.', {
      reply_markup: statusKeyboard(),
    })
    session.messageId = sent.message_id
    return
  }

  if (text.startsWith('/editprofile')) {
    await handleEditProfileCommand(msg)
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
    return
  }

  if (text.startsWith('/holiday')) {
    const officer = await prisma.officer.findUnique({ where: { telegramId } })
    if (!officer) {
      await bot.sendMessage(msg.chat.id, 'Not registered. Send /start to get started.')
      return
    }
    if (officer.role === 'NSF') {
      await bot.sendMessage(msg.chat.id, 'NSFs cannot log attendance. Use /roster to view the roster.')
      return
    }
    holidaySessions.set(telegramId, { step: 'start', startDate: null, endDate: null, days: null })
    await bot.sendMessage(
      msg.chat.id,
      'What is your start date? (e.g. 21/4 or 21 Apr)',
      { reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'holiday:cancel' }]] } }
    )
    return
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
        `Morning ${name}.\nNo status logged yet for today.\nUpdate before 0830.\n\nType in, mc, vl or tap Report Today.`
      )
    } catch (err) {
      logBotError('nudge send', err, { telegramId: officer.telegramId, officerId: officer.id })
    }
  }
}

module.exports = { bot, handleMessage, handleCommand, handleCallbackQuery, nudgeOfficers }
