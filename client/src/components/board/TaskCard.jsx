import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, Tag, CalendarBlank, Trash } from '@phosphor-icons/react'
import { useTasks } from '../../hooks/useTasks'

const PRIORITY_STYLES = {
  LOW:    { dot: 'bg-zinc-600',    label: 'text-zinc-500',  text: 'Low' },
  MEDIUM: { dot: 'bg-blue-500',    label: 'text-blue-400',  text: 'Medium' },
  HIGH:   { dot: 'bg-amber-400',   label: 'text-amber-400', text: 'High' },
  URGENT: { dot: 'bg-red-500',     label: 'text-red-400',   text: 'Urgent' },
}

const SCATTER_OFFSETS = [
  { dx: '0px', dy: '-20px' },
  { dx: '17px', dy: '-14px' },
  { dx: '17px', dy: '14px' },
  { dx: '0px', dy: '20px' },
  { dx: '-17px', dy: '14px' },
  { dx: '-17px', dy: '-14px' },
]

export default function TaskCard({ task, overlay = false }) {
  const { editTask, removeTask } = useTasks()
  const [isYapping, setIsYapping] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: overlay })

  const style = overlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const prio = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM
  const isYappd = task.status === 'YAPPD'

  const handleYappdIt = async () => {
    if (isYappd || isYapping) return
    setIsYapping(true)
    await new Promise(r => setTimeout(r, 180))
    await editTask(task.id, { status: 'YAPPD' })
  }

  const handleUnYappd = async () => {
    if (!isYappd) return
    await editTask(task.id, { status: 'TODO' })
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    await removeTask(task.id)
  }

  const formattedDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isYappd

  return (
    <AnimatePresence>
      {!isYapping && (
        <motion.div
          ref={setNodeRef}
          style={style}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.88, y: -6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`group relative cursor-grab active:cursor-grabbing select-none ${
            isDragging ? 'opacity-40' : ''
          } ${overlay ? 'cursor-grabbing shadow-2xl' : ''}`}
          onMouseEnter={() => setShowDelete(true)}
          onMouseLeave={() => setShowDelete(false)}
          {...attributes}
          {...listeners}
        >
          {/* Outer shell — Double-Bezel */}
          <div className={`rounded-xl border transition-all duration-200 ${
            isYappd
              ? 'border-emerald-900/50 bg-emerald-950/20'
              : 'border-zinc-800/70 bg-zinc-900/50 hover:border-zinc-700/80'
          } p-[3px]`}
            style={!isYappd ? {
              '--hover-shadow': '0 4px 24px rgba(37,99,235,0.06)',
            } : {}}
          >
            {/* Inner core */}
            <div
              className={`rounded-[9px] p-3.5 ${isYappd ? 'bg-zinc-900/60' : 'bg-zinc-900'}`}
              style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.04)' }}
            >
              {/* Top row: complete button + title + delete */}
              <div className="flex items-start gap-2.5">
                {/* Complete / unYappd button */}
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={isYappd ? handleUnYappd : handleYappdIt}
                  className="mt-[1px] shrink-0 transition-transform duration-150 active:scale-90 cursor-pointer"
                  aria-label={isYappd ? 'Mark as todo' : 'Yappd it'}
                >
                  {isYappd
                    ? <CheckCircle size={16} weight="fill" className="text-emerald-500" />
                    : <Circle size={16} weight="regular" className="text-zinc-600 group-hover:text-zinc-400 transition-colors duration-150" />
                  }
                </button>

                <p className={`flex-1 text-sm leading-snug tracking-tight transition-colors duration-150 ${
                  isYappd ? 'text-zinc-600 line-through' : 'text-zinc-200'
                }`}>
                  {task.title}
                </p>

                {/* Delete button */}
                <AnimatePresence>
                  {showDelete && !overlay && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.12 }}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={handleDelete}
                      className="shrink-0 mt-[1px] text-zinc-700 hover:text-red-400 transition-colors duration-150 cursor-pointer"
                      aria-label="Delete task"
                    >
                      <Trash size={13} weight="bold" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Meta row */}
              {(task.tag || task.priority !== 'MEDIUM' || formattedDate) && (
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {task.tag && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 bg-zinc-800/60 border border-zinc-800 px-1.5 py-0.5 rounded">
                      <Tag size={9} weight="bold" />
                      {task.tag}
                    </span>
                  )}
                  {task.priority !== 'MEDIUM' && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${prio.label}`}>
                      <span className={`w-1 h-1 rounded-full ${prio.dot}`} />
                      {prio.text}
                    </span>
                  )}
                  {formattedDate && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      isOverdue ? 'text-red-400' : 'text-zinc-600'
                    }`}>
                      <CalendarBlank size={9} weight="bold" />
                      {formattedDate}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CSS Particle burst — shown when task enters YAPPD */}
          {showParticles && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {SCATTER_OFFSETS.map((offset, i) => (
                <span
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-emerald-400"
                  style={{
                    '--dx': offset.dx,
                    '--dy': offset.dy,
                    animation: `yappd-scatter 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 30}ms forwards`,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
