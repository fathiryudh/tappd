import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckFat, Circle, ArrowRight } from '@phosphor-icons/react'
import TaskCard from './TaskCard'
import { useTasks } from '../../hooks/useTasks'

const COLUMN_CONFIG = {
  TODO: {
    label: 'To Do',
    width: 'w-64',
    indicator: <Circle size={8} weight="fill" className="text-zinc-500" />,
    emptyText: 'Nothing queued up',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    width: 'w-80',
    indicator: <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse block" />,
    emptyText: 'Drag a task here to start',
  },
  YAPPD: {
    label: 'Yappd',
    width: 'w-56',
    indicator: <CheckFat size={8} weight="fill" className="text-emerald-500" />,
    emptyText: 'Ship something',
  },
}

export default function KanbanColumn({ status, tasks }) {
  const { addTask } = useTasks()
  const config = COLUMN_CONFIG[status]
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  const { setNodeRef, isOver } = useDroppable({ id: status })

  useEffect(() => {
    if (isAdding) inputRef.current?.focus()
  }, [isAdding])

  const handleAddSubmit = async () => {
    const title = inputValue.trim()
    if (!title) { setIsAdding(false); return }
    setInputValue('')
    setIsAdding(false)
    await addTask({ title, status })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddSubmit()
    if (e.key === 'Escape') { setIsAdding(false); setInputValue('') }
  }

  const taskIds = tasks.map(t => t.id)

  return (
    <div className={`${config.width} shrink-0 flex flex-col`}>
      {/* Column header */}
      <div className="relative flex items-center gap-2 px-1 mb-3 h-7">
        <span className="absolute -top-1 right-1 text-5xl font-black tabular-nums select-none pointer-events-none"
          style={{ color: 'rgba(39,39,42,0.5)', lineHeight: 1 }}>
          {tasks.length}
        </span>
        <span className="flex items-center justify-center w-3 h-3 shrink-0">
          {config.indicator}
        </span>
        <span className="text-xs font-medium text-zinc-500 tracking-wide">{config.label}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2.5 min-h-[120px] rounded-xl transition-colors duration-200 ${
          isOver ? 'bg-zinc-900/40' : ''
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <TaskCard task={task} />
            </motion.div>
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && !isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="flex items-center justify-center h-16 rounded-xl border border-dashed border-zinc-800/60"
          >
            <span className="text-xs text-zinc-700">{config.emptyText}</span>
          </motion.div>
        )}

        {/* Inline add input */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-[3px]"
            >
              <div className="rounded-[9px] bg-zinc-900 p-2.5 flex items-center gap-2"
                style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.04)' }}>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAddSubmit}
                  placeholder="Task title..."
                  className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none"
                />
                <button
                  onMouseDown={e => { e.preventDefault(); handleAddSubmit() }}
                  className="shrink-0 text-zinc-600 hover:text-blue-400 transition-colors duration-150 cursor-pointer"
                >
                  <ArrowRight size={13} weight="bold" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add task ghost button — hidden for YAPPD */}
        {status !== 'YAPPD' && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-700 hover:text-zinc-500 hover:bg-zinc-900/50 transition-all duration-150 cursor-pointer text-xs w-full"
          >
            <Plus size={12} weight="bold" />
            Add task
          </button>
        )}
      </div>
    </div>
  )
}
