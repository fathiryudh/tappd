import { motion } from 'framer-motion'

const RADIUS = 16
const STROKE = 2.5
const SIZE = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function BurndownRing({ pct = 0, completedToday = 0, total = 0 }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, pct)))

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#27272a"
            strokeWidth={STROKE}
          />
          {/* Progress arc */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#2563EB"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.3 }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-mono font-semibold text-zinc-400 tabular-nums">
            {Math.round(pct * 100)}%
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        <p className="text-[11px] font-medium text-zinc-400 tabular-nums">
          {completedToday}/{total}
        </p>
        <p className="text-[10px] text-zinc-700">today</p>
      </div>
    </div>
  )
}
