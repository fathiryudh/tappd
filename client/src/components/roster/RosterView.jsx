import { useState, useEffect, useCallback } from 'react'

const COLORS = {
  shell: 'rgba(0, 0, 0, 0.03)',
  surface: '#FFFFFF',
  soft: '#F5F5F2',
  line: 'rgba(0, 0, 0, 0.06)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#4F46E5',
  info: '#111111',
  infoSoft: 'rgba(0,0,0,0.04)',
  success: '#265D47',
  successSoft: '#EDF7F0',
  warning: '#9A6700',
  warningSoft: '#FFF6DB',
  danger: '#9B3B36',
  dangerSoft: '#FCEDED',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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

// ── Status helpers ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const AFTERNOON_START_HOUR = 13

function getReasonLabel(reason) {
  return reason ? reason.toUpperCase() : ''
}

function formatOutLabel(reason) {
  const value = getReasonLabel(reason)
  return value ? `OUT · ${value}` : 'OUT'
}

function parseSplitStatus(avail) {
  const notes = avail.notes || ''
  const amIn = notes.startsWith('AM in')
  const pmIn = notes.includes('PM in')
  const reasonMatch = notes.match(/out \(([^)]+)\)/)
  const reason = reasonMatch ? reasonMatch[1] : avail.reason || ''

  return {
    am: { type: amIn ? 'in' : 'out', label: amIn ? 'IN' : formatOutLabel(reason) },
    pm: { type: pmIn ? 'in' : 'out', label: pmIn ? 'IN' : formatOutLabel(reason) },
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function RosterView() {
  const now = new Date()
  const todayISO = localISODate(now)
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(todayISO))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const week = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
  const isCurrentWeek = week.includes(todayISO)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/weekly-roster?week=${weekStart}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Could not load roster data.')
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    setLoading(true)
    setRevealed(false)
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setRevealed(true), 40)
      return () => clearTimeout(t)
    }
  }, [loading])

  // Today's summary counts
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
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
            style={{ background: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.68)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: isCurrentWeek ? COLORS.success : 'rgba(15,23,42,0.42)' }}
            />
            SCDF 2 Div HQ · Tampines
          </span>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1
              className="text-[2.9rem] font-semibold leading-none tracking-[-0.09em] md:text-[4.6rem]"
              style={{ color: COLORS.text }}
            >
              Attendance
            </h1>
            <p
              className="mt-3 text-base md:text-lg"
              style={{ color: COLORS.muted }}
            >
              {weekLabel}
            </p>
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

            <div className="flex items-center gap-1">
              <NavBtn onClick={prevWeek}>←</NavBtn>
              {!isCurrentWeek && (
                <NavBtn onClick={goToday} small>Today</NavBtn>
              )}
              <NavBtn onClick={nextWeek}>→</NavBtn>
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-[2rem] p-[6px]"
        style={{
          background: COLORS.shell,
          boxShadow: `0 0 0 1px ${COLORS.line}`,
        }}
      >
        <div
          className="rounded-[calc(2rem-0.5rem)] overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.96)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 600ms cubic-bezier(0.32,0.72,0,1), transform 600ms cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
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
        </div>
      </div>

      {!loading && !error && total > 0 && (
        <p
          className="mt-4 text-center text-[11px]"
          style={{ color: COLORS.muted }}
        >
          {total} officer{total !== 1 ? 's' : ''} · refreshes every minute
        </p>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavBtn({ onClick, children, small }) {
  return (
    <button
      onClick={onClick}
      className={`${small ? 'px-3 py-1 rounded-full text-[11px] font-medium' : 'w-8 h-8 rounded-full flex items-center justify-center text-sm'} transition-colors duration-200`}
      style={{ color: COLORS.muted }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'rgba(0,0,0,0.7)' }}
      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = COLORS.muted }}
    >
      {children}
    </button>
  )
}

function MobileOfficerCard({ officer, week, todayISO, now, idx, revealed }) {
  return (
    <article
      className="border-b px-4 py-4"
      style={{
        borderColor: COLORS.line,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms, transform 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms`,
      }}
    >
      <div className="text-base font-semibold tracking-[-0.03em]" style={{ color: COLORS.text }}>
        {officer.name}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {week.map((date, i) => {
          const isToday = date === todayISO
          const { type, label, detail } = parseStatus(officer.days[date], { date, todayISO, now })

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
              {type === 'none' ? (
                <span style={{ color: COLORS.muted, fontSize: '14px' }}>—</span>
              ) : (
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${PILL[type]}`}
                    style={
                      type === 'in'
                        ? { '--pill-bg': COLORS.successSoft, '--pill-fg': COLORS.success, '--pill-ring': 'rgba(38,93,71,0.12)' }
                        : type === 'out'
                          ? { '--pill-bg': COLORS.dangerSoft, '--pill-fg': COLORS.danger, '--pill-ring': 'rgba(155,59,54,0.12)' }
                          : { '--pill-bg': '#F2EEFF', '--pill-fg': COLORS.brand, '--pill-ring': 'rgba(79,70,229,0.14)' }
                    }
                  >
                    {label}
                  </span>
                  {detail && (
                    <div className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>
                      {detail}
                    </div>
                  )}
                </div>
              )}
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
      style={{
        borderBottom: `1px solid ${COLORS.line}`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms, transform 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms`,
      }}
    >
      <td
        className="py-3 pl-6 pr-4 text-sm font-medium whitespace-nowrap"
        style={{ color: COLORS.text }}
      >
        {officer.name}
      </td>
      {week.map(date => {
        const isToday = date === todayISO
        const { type, label, detail } = parseStatus(officer.days[date], { date, todayISO, now })
        return (
          <td
            key={date}
            className="px-2 py-2.5 text-center"
            style={{ background: isToday ? 'rgba(31,105,255,0.03)' : 'transparent' }}
          >
            {type === 'none' ? (
              <span style={{ color: COLORS.muted, fontSize: '13px' }}>—</span>
            ) : (
              <div>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${PILL[type]}`}
                  style={
                    type === 'in'
                      ? { '--pill-bg': COLORS.successSoft, '--pill-fg': COLORS.success, '--pill-ring': 'rgba(10,130,23,0.16)' }
                      : type === 'out'
                        ? { '--pill-bg': COLORS.dangerSoft, '--pill-fg': COLORS.danger, '--pill-ring': 'rgba(215,38,15,0.16)' }
                        : { '--pill-bg': '#F2EEFF', '--pill-fg': COLORS.brand, '--pill-ring': 'rgba(79,70,229,0.14)' }
                  }
                >
                  {label}
                </span>
                {detail && (
                  <div className="mt-1 text-[10px]" style={{ color: COLORS.muted }}>
                    {detail}
                  </div>
                )}
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{
              background: 'rgba(89,37,220,0.28)',
              animation: 'pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 180}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: COLORS.muted }}>
      {message}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: COLORS.muted }}>
      No officers registered yet.
    </div>
  )
}
