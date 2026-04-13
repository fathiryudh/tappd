import { Flame } from '@phosphor-icons/react'

export default function StreakBadge({ streak = 0 }) {
  if (streak === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
      <Flame
        size={13}
        weight="fill"
        className={streak >= 7 ? 'text-orange-400' : 'text-zinc-500'}
      />
      <span className="text-xs font-semibold tabular-nums text-zinc-200">{streak}</span>
      <span className="text-[10px] text-zinc-600 font-medium">
        {streak === 1 ? 'day' : 'day streak'}
      </span>
    </div>
  )
}
