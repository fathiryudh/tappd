import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Terminal } from '@phosphor-icons/react'
import { useTasks } from '../../hooks/useTasks'
import BurndownRing from './BurndownRing'
import StreakBadge from './StreakBadge'

function computeStreak(tasks) {
  const yappdTasks = tasks.filter(t => t.completedAt)
  if (yappdTasks.length === 0) return 0

  const dayStrings = new Set(
    yappdTasks.map(t => new Date(t.completedAt).toDateString())
  )

  const today = new Date()
  let streak = 0
  let cursor = new Date(today)

  while (true) {
    const key = cursor.toDateString()
    if (!dayStrings.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export default function BoardHeader({ onPaletteOpen }) {
  const { tasks } = useTasks()

  const { completedToday, burndownPct, streak } = useMemo(() => {
    const today = new Date().toDateString()
    const completedToday = tasks.filter(
      t => t.completedAt && new Date(t.completedAt).toDateString() === today
    )
    const burndownPct = tasks.length > 0 ? completedToday.length / tasks.length : 0
    const streak = computeStreak(tasks)
    return { completedToday: completedToday.length, burndownPct, streak }
  }, [tasks])

  return (
    <header className="flex items-center px-8 py-4 border-b border-zinc-800/60">
      {/* Left: title */}
      <div className="flex-1 min-w-0">
        <motion.h1
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm font-semibold tracking-tight text-zinc-100"
        >
          Board
        </motion.h1>
        <p className="text-[11px] text-zinc-700 mt-0.5 hidden sm:block">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Right cluster: burndown + streak + ⌘K */}
      <div className="flex items-center gap-3">
        <BurndownRing
          pct={burndownPct}
          completedToday={completedToday}
          total={tasks.length}
        />

        <StreakBadge streak={streak} />

        {/* ⌘K trigger */}
        <motion.button
          whileTap={{ scale: 0.96, y: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={onPaletteOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all duration-200 cursor-pointer"
        >
          <Terminal size={13} weight="bold" />
          <span className="text-xs font-medium hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline text-[10px] font-mono text-zinc-700 bg-zinc-800 px-1 py-0.5 rounded">
            ⌘K
          </kbd>
        </motion.button>
      </div>
    </header>
  )
}
