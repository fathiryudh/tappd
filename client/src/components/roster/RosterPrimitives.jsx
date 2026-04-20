import { ROSTER_COLORS } from './rosterTheme'

export function RosterLocationBadge({ indicatorColor = ROSTER_COLORS.brand }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
      style={{ background: 'rgba(15,23,42,0.06)', color: 'rgba(15,23,42,0.68)' }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: indicatorColor }} />
      LIVE
    </span>
  )
}

export function RosterShell({
  children,
  outerClassName = '',
  innerClassName = '',
  innerStyle,
}) {
  return (
    <div
      className={`rounded-[2rem] p-[6px] ${outerClassName}`.trim()}
      style={{ background: ROSTER_COLORS.shell, boxShadow: `0 0 0 1px ${ROSTER_COLORS.line}` }}
    >
      <div
        className={`rounded-[calc(2rem-0.5rem)] overflow-hidden ${innerClassName}`.trim()}
        style={{ background: 'rgba(255,255,255,0.96)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)', ...innerStyle }}
      >
        {children}
      </div>
    </div>
  )
}

export function RosterLoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="block h-1.5 w-1.5 rounded-full"
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

export function RosterErrorState({ message }) {
  return (
    <div className="flex items-center justify-center py-24 text-sm" style={{ color: ROSTER_COLORS.muted }}>
      {message}
    </div>
  )
}
