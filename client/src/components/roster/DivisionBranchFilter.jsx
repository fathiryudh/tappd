import { PushPin } from '@phosphor-icons/react'
import { ROSTER_COLORS as COLORS } from './rosterTheme'

const CONTROL_CLASS =
  'rounded-full border border-transparent px-4 py-2.5 text-sm transition-colors duration-200 focus:outline-none'
const CONTROL_STYLE = { color: COLORS.text, background: COLORS.soft }

export default function DivisionBranchFilter({
  divisions,
  branches,
  filter,
  onFilterChange,
  pinnedFilter,
  onPin,
  onUnpin,
}) {
  const handleDivisionChange = (e) => {
    onFilterChange({ divisionId: e.target.value, branchId: '' })
  }

  const handleBranchChange = (e) => {
    onFilterChange({ ...filter, branchId: e.target.value })
  }

  const isPinned =
    pinnedFilter &&
    pinnedFilter.divisionId === filter.divisionId &&
    pinnedFilter.branchId === filter.branchId

  const hasFilter = filter.divisionId || filter.branchId

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filter.divisionId}
        onChange={handleDivisionChange}
        className={CONTROL_CLASS}
        style={CONTROL_STYLE}
        onMouseEnter={(e) => { e.target.style.background = 'rgba(0,0,0,0.07)' }}
        onMouseLeave={(e) => { e.target.style.background = COLORS.soft }}
        onFocus={(e) => {
          e.target.style.background = COLORS.soft
          e.target.style.boxShadow = `0 0 0 1px ${COLORS.info}`
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = 'none'
        }}
      >
        <option value="">All divisions</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <select
        value={filter.branchId}
        onChange={handleBranchChange}
        disabled={!filter.divisionId}
        className={CONTROL_CLASS}
        style={{
          ...CONTROL_STYLE,
          opacity: filter.divisionId ? 1 : 0.5,
          cursor: filter.divisionId ? 'pointer' : 'not-allowed',
        }}
        onMouseEnter={(e) => { if (filter.divisionId) e.target.style.background = 'rgba(0,0,0,0.07)' }}
        onMouseLeave={(e) => { e.target.style.background = COLORS.soft }}
        onFocus={(e) => {
          e.target.style.background = COLORS.soft
          e.target.style.boxShadow = `0 0 0 1px ${COLORS.info}`
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = 'none'
        }}
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {hasFilter && (
        <button
          onClick={isPinned ? onUnpin : onPin}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[11px] font-medium transition-all duration-200"
          style={{
            background: isPinned ? COLORS.infoSoft : 'transparent',
            color: isPinned ? COLORS.info : COLORS.muted,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isPinned ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.04)'
            e.currentTarget.style.color = COLORS.text
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isPinned ? COLORS.infoSoft : 'transparent'
            e.currentTarget.style.color = isPinned ? COLORS.info : COLORS.muted
          }}
          title={isPinned ? 'Unpin this filter' : 'Pin this filter as default'}
        >
          <PushPin size={13} weight={isPinned ? 'fill' : 'regular'} />
          <span>{isPinned ? 'Pinned' : 'Pin'}</span>
        </button>
      )}
    </div>
  )
}
