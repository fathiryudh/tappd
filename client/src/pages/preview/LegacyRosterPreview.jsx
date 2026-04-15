import { useState, useEffect, useCallback } from 'react'

function getMondayOfWeek(isoDate) {
  const d = new Date(isoDate)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function addDays(isoDate, n) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtShort(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function parseStatus(avail) {
  if (!avail) return { type: 'none', label: '—' }

  if (avail.notes && avail.notes.includes('AM')) {
    const notes = avail.notes
    const amIn = notes.startsWith('AM in')
    const pmIn = notes.includes('PM in')
    const reasonMatch = notes.match(/out \(([^)]+)\)/)
    const reason = reasonMatch ? reasonMatch[1].toUpperCase() : ''
    const amText = amIn ? 'IN' : (reason ? `OUT·${reason}` : 'OUT')
    const pmText = pmIn ? 'IN' : (reason ? `OUT·${reason}` : 'OUT')
    return { type: 'split', label: `${amText} / ${pmText}` }
  }

  if (avail.status === 'IN') return { type: 'in', label: 'IN' }

  const reason = avail.reason ? avail.reason.toUpperCase() : ''
  return { type: 'out', label: reason ? `OUT · ${reason}` : 'OUT' }
}

const PILL = {
  in: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80',
  out: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/80',
  split: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/80',
  none: '',
}

export default function LegacyRosterPreview() {
  const todayISO = new Date().toISOString().split('T')[0]
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

  let inCount = 0
  let outCount = 0
  let unconfirmed = 0
  if (data && isCurrentWeek) {
    for (const o of data.officers) {
      const d = o.days[todayISO]
      if (!d) unconfirmed++
      else if (d.status === 'IN') inCount++
      else outCount++
    }
  }

  const weekLabel = `${fmtShort(week[0])} - ${fmtShort(week[4])}`
  const total = data?.officers?.length ?? 0

  function prevWeek() { setWeekStart((prev) => addDays(getMondayOfWeek(prev), -7)) }
  function nextWeek() { setWeekStart((prev) => addDays(getMondayOfWeek(prev), 7)) }
  function goToday() { setWeekStart(getMondayOfWeek(todayISO)) }

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        background: '#f7f7f5',
        fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        color: '#0a0a0a',
      }}
    >
      <header className="px-5 pt-10 pb-6 md:px-14 md:pt-16 md:pb-10">
        <div className="max-w-[1440px] mx-auto">
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: isCurrentWeek ? '#10b981' : 'rgba(0,0,0,0.25)' }}
              />
              SCDF 2 Div HQ · Tampines
            </span>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1
                className="text-[2.6rem] md:text-[3.75rem] font-bold leading-none tracking-tight"
                style={{ color: 'rgba(0,0,0,0.88)' }}
              >
                Attendance
              </h1>
              <p className="mt-2 text-base font-light" style={{ color: 'rgba(0,0,0,0.38)' }}>
                {weekLabel}
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-3">
              {isCurrentWeek && !loading && data && (
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${PILL.in}`}>{inCount} in</span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${PILL.out}`}>{outCount} out</span>
                  {unconfirmed > 0 && (
                    <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80">
                      {unconfirmed} unconfirmed
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-0.5">
                <button
                  onClick={prevWeek}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300"
                  style={{ color: 'rgba(0,0,0,0.35)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                >
                  ←
                </button>
                {!isCurrentWeek && (
                  <button
                    onClick={goToday}
                    className="px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-300"
                    style={{ color: 'rgba(0,0,0,0.45)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  >
                    Today
                  </button>
                )}
                <button
                  onClick={nextWeek}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300"
                  style={{ color: 'rgba(0,0,0,0.35)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 md:px-10">
        <div className="max-w-[1440px] mx-auto">
          <div
            className="p-[6px] rounded-[2rem]"
            style={{ background: 'rgba(0,0,0,0.03)', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
          >
            <div
              className="rounded-[calc(2rem-6px)] overflow-hidden"
              style={{
                background: '#ffffff',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.9)',
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <th
                          className="text-left py-4 pl-6 pr-4 text-[10px] font-semibold uppercase tracking-[0.15em]"
                          style={{ color: 'rgba(0,0,0,0.3)', width: '200px' }}
                        >
                          Officer
                        </th>
                        {week.map((date, i) => {
                          const isToday = date === todayISO
                          return (
                            <th
                              key={date}
                              className="text-center px-2 py-4"
                              style={{ background: isToday ? 'rgba(0,0,0,0.02)' : 'transparent' }}
                            >
                              <span
                                className="block text-[9px] uppercase tracking-[0.18em] font-semibold mb-0.5"
                                style={{ color: isToday ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.22)' }}
                              >
                                {DAY_LABELS[i]}
                              </span>
                              <span
                                className="block text-sm"
                                style={{
                                  fontWeight: isToday ? 700 : 500,
                                  color: isToday ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.38)',
                                }}
                              >
                                {fmtShort(date).split(' ')[0]}
                              </span>
                              {isToday && (
                                <span className="block w-1 h-1 rounded-full mx-auto mt-1" style={{ background: 'rgba(0,0,0,0.5)' }} />
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
                          idx={idx}
                          revealed={revealed}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {!loading && !error && total > 0 && (
            <p className="mt-4 text-center text-[11px]" style={{ color: 'rgba(0,0,0,0.22)' }}>
              {total} officer{total !== 1 ? 's' : ''} · refreshes every minute
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function OfficerRow({ officer, week, todayISO, idx, revealed }) {
  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms, transform 500ms cubic-bezier(0.32,0.72,0,1) ${idx * 28}ms`,
      }}
    >
      <td className="py-3 pl-6 pr-4 text-sm font-medium whitespace-nowrap" style={{ color: 'rgba(0,0,0,0.78)' }}>
        {officer.name}
      </td>
      {week.map((date) => {
        const isToday = date === todayISO
        const { type, label } = parseStatus(officer.days[date])
        return (
          <td
            key={date}
            className="px-2 py-2.5 text-center"
            style={{ background: isToday ? 'rgba(0,0,0,0.015)' : 'transparent' }}
          >
            {type === 'none' ? (
              <span style={{ color: 'rgba(0,0,0,0.18)', fontSize: '13px' }}>—</span>
            ) : (
              <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${PILL[type]}`}>
                {label}
              </span>
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
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.2)', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'rgba(0,0,0,0.3)' }}>
      {message}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: 'rgba(0,0,0,0.25)' }}>
      No officers registered yet.
    </div>
  )
}
