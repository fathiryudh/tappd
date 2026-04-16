function localISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseISODateUTC(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localISODate(d)
}

function getMondayOfWeek(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localISODate(d)
}

function getNextWeekMonday(isoDate) {
  return addDays(getMondayOfWeek(isoDate), 7)
}

function toUTCStartOfDay(isoDate) {
  return parseISODateUTC(isoDate)
}

function buildWorkWeek(weekStart) {
  return Array.from({ length: 5 }, (_, index) => addDays(weekStart, index))
}

function getDayISO(targetDow, todayISO) {
  const d = new Date(`${todayISO}T00:00:00`)
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== targetDow) {
    d.setDate(d.getDate() + 1)
  }
  return localISODate(d)
}

module.exports = {
  addDays,
  buildWorkWeek,
  getMondayOfWeek,
  getNextWeekMonday,
  getDayISO,
  localISODate,
  parseISODateUTC,
  toUTCStartOfDay,
}
