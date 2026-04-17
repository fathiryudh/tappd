import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import {
  RosterErrorState,
  RosterLoadingState,
  RosterLocationBadge,
  RosterShell,
} from './RosterPrimitives'
import DivisionBranchFilter from './DivisionBranchFilter'
import { ROSTER_COLORS as BASE_COLORS, getRevealStyle } from './rosterTheme'

const COLORS = {
  ...BASE_COLORS,
  brand: '#4F46E5',
}

function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMondayOfWeek(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localISODate(d)
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localISODate(d)
}

function fmtShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const AFTERNOON_START_HOUR = 13

function getReasonLabel(reason) {
  return reason ? reason.toUpperCase() : ''
}

function formatOutLabel(reason) {
  const value = getReasonLabel(reason)
  return value ? `OUT · ${value}` : 'OUT'
}

function parseSplitHalf(notes, period) {
  const modern = notes.match(new RegExp(`${period}\\s+(IN|OUT(?:\\(([^)]+)\\))?)`, 'i'))
  if (modern) {
    const token = modern[1].toUpperCase()
    return {
      in: token.startsWith('IN'),
      reason: modern[2] || '',
    }
  }

  const legacyIn = new RegExp(`${period.toLowerCase()} in`, 'i').test(notes)
  const legacyOut = notes.match(new RegExp(`${period.toLowerCase()} out \\(([^)]+)\\)`, 'i'))
  return {
    in: legacyIn,
    reason: legacyOut ? legacyOut[1] : '',
  }
}

function parseSplitStatus(avail) {
  const notes = avail.notes || ''
  const am = parseSplitHalf(notes, 'AM')
  const pm = parseSplitHalf(notes, 'PM')

  return {
    am: { type: am.in ? 'in' : 'out', label: am.in ? 'IN' : formatOutLabel(am.reason || avail.reason) },
    pm: { type: pm.in ? 'in' : 'out', label: pm.in ? 'IN' : formatOutLabel(pm.reason || avail.reason) },
  }
}

function parseStatus(avail, { date, todayISO, now = new Date() } = {}) {
  if (!avail) return { type: 'none', label: '—' }

  if (avail.notes && avail.notes.includes('AM')) {
    const split = parseSplitStatus(avail)
    const splitLabel = `${split.am.label} / ${split.pm.label}`

    if (date && date === todayISO) {
      const activeHalf = now.getHours() >= AFTERNOON_START_HOUR ? split.pm : split.am
      return {
        type: activeHalf.type,
        label: activeHalf.label,
        detail: splitLabel,
        split: true,
      }
    }

    return { type: 'split', label: splitLabel, split: true }
  }

  if (avail.status === 'IN') return { type: 'in', label: 'IN' }

  return { type: 'out', label: formatOutLabel(avail.reason) }
}

function getActiveStatusType(avail, { date, todayISO, now = new Date() } = {}) {
  const parsed = parseStatus(avail, { date, todayISO, now })
  return parsed.type
}

const PILL = {
  in:    'bg-[var(--pill-bg)] text-[var(--pill-fg)] ring-1 ring-inset ring-[var(--pill-ring)]',
  out:   'bg-[var(--pill-bg)] text-[var(--pill-fg)] ring-1 ring-inset ring-[var(--pill-ring)]',
  split: 'bg-[var(--pill-bg)] text-[var(--pill-fg)] ring-1 ring-inset ring-[var(--pill-ring)]',
  none:  '',
}

function getStatusTone(type) {
  if (type === 'in') {
    return { '--pill-bg': COLORS.successSoft, '--pill-fg': COLORS.success, '--pill-ring': 'rgba(38,93,71,0.12)' }
  }

  if (type === 'out') {
    return { '--pill-bg': COLORS.dangerSoft, '--pill-fg': COLORS.danger, '--pill-ring': 'rgba(155,59,54,0.12)' }
  }

  return { '--pill-bg': '#F2EEFF', '--pill-fg': COLORS.brand, '--pill-ring': 'rgba(79,70,229,0.14)' }
}

function getRowRevealStyle(revealed, idx) {
  return getRevealStyle(revealed, { distance: 8, delay: idx * 28, duration: 500 })
}

export default function RosterView({
  refreshToken = 0,
  filter = { divisionId: '', branchId: '' },
  onFilterChange,
  divisions = [],
  branches = [],
  pinnedFilter,
  onPin,
  onUnpin,
}) {
  const now = new Date()
  const todayISO = localISODate(now)
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(todayISO))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const isMountedRef = useRef(true)
  const fetchDataRef = useRef(null)

  const week = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
  const isCurrentWeek = week.includes(todayISO)

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
      setRevealed(false)
    }

    try {
      const params = new URLSearchParams({ week: weekStart })
      if (filter.divisionId) params.set('divisionId', filter.divisionId)
      if (filter.branchId) params.set('branchId', filter.branchId)
      const res = await fetch(`/weekly-roster?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!isMountedRef.current) return
      setData(json)
      setError(null)
    } catch {
      if (!isMountedRef.current) return
      setError('Could not load roster data.')
    } finally {
      if (!isMountedRef.current) return
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [weekStart, filter.divisionId, filter.branchId])

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData({ silent: true }), 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (refreshToken > 0) {
      fetchDataRef.current?.({ silent: true })
    }
  }, [refreshToken])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setRevealed(true), 40)
      return () => clearTimeout(t)
    }
  }, [loading])

  let inCount = 0, outCount = 0, unconfirmed = 0
  if (data && isCurrentWeek) {
    for (const o of data.officers) {
      const d = o.days[todayISO]
      if (!d) unconfirmed++
      else if (getActiveStatusType(d, { date: todayISO, todayISO, now }) === 'in') inCount++
      else outCount++
    }
  }

  const weekLabel = `${fmtShort(week[0])} – ${fmtShort(week[4])}`
  const total = data?.officers?.length ?? 0

  function prevWeek() { setWeekStart(prev => addDays(getMondayOfWeek(prev), -7)) }
  function nextWeek() { setWeekStart(prev => addDays(getMondayOfWeek(prev),  7)) }
  function goToday()  { setWeekStart(getMondayOfWeek(todayISO)) }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <div className="mb-5">
          <RosterLocationBadge indicatorColor={isCurrentWeek ? COLORS.success : 'rgba(15,23,42,0.42)'} />
        </div>

        {onFilterChange && (
          <div className="mb-5">
            <DivisionBranchFilter
              divisions={divisions}
              branches={branches}
              filter={filter}
              onFilterChange={onFilterChange}
              pinnedFilter={pinnedFilter}
              onPin={onPin}
              onUnpin={onUnpin}
            />
          </div>
        )}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1
              className="text-[2.9rem] font-semibold leading-none tracking-[-0.09em] md:text-[4.6rem]"
              style={{ color: COLORS.text }}
            >
              Attendance
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-base md:text-lg" style={{ color: COLORS.muted }}>
                {weekLabel}
              </span>
              <div
                className="flex items-center rounded-full px-0.5 py-0.5"
                style={{ background: 'rgba(0,0,0,0.06)' }}
              >
                <NavBtn onClick={prevWeek}>←</NavBtn>
                {!isCurrentWeek && (
                  <NavBtn onClick={goToday} small>Today</NavBtn>
                )}
                <NavBtn onClick={nextWeek}>→</NavBtn>
              </div>
              <NavBtn
                onClick={() => fetchData({ silent: true })}
                small
                disabled={refreshing}
                title={refreshing ? 'Refreshing attendance' : 'Refresh attendance'}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowsClockwise size={12} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Refreshing' : 'Refresh'}
                </span>
              </NavBtn>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {isCurrentWeek && !loading && data && (
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${PILL.in}`}
                  style={{ '--pill-bg': COLORS.successSoft, '--pill-fg': COLORS.success, '--pill-ring': 'rgba(10,130,23,0.16)' }}
                >
                  {inCount} in
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${PILL.out}`}
                  style={{ '--pill-bg': COLORS.dangerSoft, '--pill-fg': COLORS.danger, '--pill-ring': 'rgba(215,38,15,0.16)' }}
                >
                  {outCount} out
                </span>
                {unconfirmed > 0 && (
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset"
                    style={{ background: COLORS.warningSoft, color: COLORS.warning, boxShadow: 'inset 0 0 0 1px rgba(247,144,9,0.16)' }}
                  >
                    {unconfirmed} unconfirmed
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <RosterShell
        innerStyle={getRevealStyle(revealed)}
      >
          {loading ? (
            <RosterLoadingState />
          ) : error ? (
            <RosterErrorState message={error} />
          ) : total === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="md:hidden">
                {data.officers.map((officer, idx) => (
                  <MobileOfficerCard
                    key={officer.id}
                    officer={officer}
                    week={week}
                    todayISO={todayISO}
                    now={now}
                    idx={idx}
                    revealed={revealed}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <th
                      className="text-left py-4 pl-6 pr-4 text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: COLORS.muted, width: '200px' }}
                    >
                      Officer
                    </th>
                    {week.map((date, i) => {
                      const isToday = date === todayISO
                      return (
                        <th
                          key={date}
                          className="text-center px-2 py-4"
                          style={{
                            background: isToday ? 'rgba(31,105,255,0.04)' : 'transparent',
                          }}
                        >
                          <span
                            className="block text-[9px] uppercase tracking-[0.18em] font-semibold mb-0.5"
                            style={{ color: isToday ? COLORS.info : COLORS.muted }}
                          >
                            {DAY_LABELS[i]}
                          </span>
                          <span
                            className="block text-sm"
                            style={{
                              fontWeight: isToday ? 700 : 500,
                              color: isToday ? COLORS.text : COLORS.muted,
                            }}
                          >
                            {fmtShort(date).split(' ')[0]}
                          </span>
                          {isToday && (
                            <span
                              className="block w-1 h-1 rounded-full mx-auto mt-1"
                              style={{ background: COLORS.info }}
                            />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.officers.map((officer, idx) => (
                    <OfficerRow
                      key={officer.id}
                      officer={officer}
                      week={week}
                      todayISO={todayISO}
                      now={now}
                      idx={idx}
                      revealed={revealed}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
      </RosterShell>

      {!loading && !error && total > 0 && (
        <p
          className="mt-4 text-center text-[11px]"
          style={{ color: COLORS.muted }}
        >
          {total} officer{total !== 1 ? 's' : ''} · refreshes every minute and on new status events
        </p>
      )}
    </div>
  )
}

function NavBtn({ onClick, children, small, disabled = false, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${small ? 'px-3 py-1 rounded-full text-[11px] font-medium' : 'w-8 h-8 rounded-full flex items-center justify-center text-sm'} transition-colors duration-200`}
      style={{ color: COLORS.muted, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
      onMouseEnter={e => {
        if (disabled) return
        e.currentTarget.style.background = 'rgba(0,0,0,0.06)'
        e.currentTarget.style.color = 'rgba(0,0,0,0.7)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = ''
        e.currentTarget.style.color = COLORS.muted
      }}
    >
      {children}
    </button>
  )
}

function StatusPill({ type, label }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[type]}`}
      style={getStatusTone(type)}
    >
      {label}
    </span>
  )
}

function StatusDetail({ detail }) {
  if (!detail) return null

  return (
    <div className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>
      {detail}
    </div>
  )
}

function OfficerStatus({ officer, date, todayISO, now }) {
  const { type, label, detail } = parseStatus(officer.days[date], { date, todayISO, now })

  if (type === 'none') {
    return <span style={{ color: COLORS.muted, fontSize: '13px' }}>—</span>
  }

  return (
    <div>
      <StatusPill type={type} label={label} />
      <StatusDetail detail={detail} />
    </div>
  )
}

function MobileOfficerCard({ officer, week, todayISO, now, idx, revealed }) {
  return (
    <article
      className="border-b px-4 py-4"
      style={{ borderColor: COLORS.line, ...getRowRevealStyle(revealed, idx) }}
    >
      <div className="text-base font-semibold tracking-[-0.03em]" style={{ color: COLORS.text }}>
        {officer.name}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {week.map((date, i) => {
          const isToday = date === todayISO

          return (
            <div
              key={date}
              className="flex items-center justify-between rounded-[1rem] px-3 py-3"
              style={{ background: isToday ? 'rgba(15,23,42,0.05)' : COLORS.soft }}
            >
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.muted }}>
                  {DAY_LABELS[i]}
                </div>
                <div className="mt-1 text-sm font-medium" style={{ color: COLORS.text }}>
                  {fmtShort(date)}
                </div>
              </div>
              <div className="text-right">
                <OfficerStatus officer={officer} date={date} todayISO={todayISO} now={now} />
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function OfficerRow({ officer, week, todayISO, now, idx, revealed }) {
  return (
    <tr
      style={{ borderBottom: `1px solid ${COLORS.line}`, ...getRowRevealStyle(revealed, idx) }}
    >
      <td
        className="py-3 pl-6 pr-4 text-sm font-medium whitespace-nowrap"
        style={{ color: COLORS.text }}
      >
        {officer.name}
      </td>
      {week.map(date => {
        const isToday = date === todayISO
        return (
          <td
            key={date}
            className="px-2 py-2.5 text-center"
            style={{ background: isToday ? 'rgba(31,105,255,0.03)' : 'transparent' }}
          >
            <OfficerStatus officer={officer} date={date} todayISO={todayISO} now={now} />
          </td>
        )
      })}
    </tr>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: COLORS.muted }}>
      No officers registered yet.
    </div>
  )
}
