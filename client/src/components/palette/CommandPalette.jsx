import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, Plus, ArrowRight, CaretRight, Hash, Lightning } from '@phosphor-icons/react'
import { useTasks } from '../../hooks/useTasks'

const NAV_ACTIONS = [
  { id: 'nav-board',     label: 'Go to Board',        icon: Lightning,     action: 'nav-board' },
  { id: 'nav-ai',        label: 'Go to AI Assistant', icon: Lightning,     action: 'nav-ai' },
  { id: 'nav-analytics', label: 'Go to Analytics',    icon: Lightning,     action: 'nav-analytics' },
]

export default function CommandPalette({ isOpen, onClose, onNavigate }) {
  const { tasks, addTask } = useTasks()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const isNav = query.startsWith('>')
  const isTag = query.startsWith('#')
  const cleanQuery = query.replace(/^[>#]/, '').trim().toLowerCase()

  const results = (() => {
    if (isNav) {
      return NAV_ACTIONS.filter(a =>
        cleanQuery === '' || a.label.toLowerCase().includes(cleanQuery)
      ).map(a => ({ ...a, type: 'nav' }))
    }
    if (isTag) {
      const tags = [...new Set(tasks.filter(t => t.tag).map(t => t.tag))]
      return tags
        .filter(tag => cleanQuery === '' || tag.toLowerCase().includes(cleanQuery))
        .map(tag => ({ id: `tag-${tag}`, label: tag, type: 'tag', action: 'filter-tag' }))
    }

    const items = []
    // Create task as first option when typing
    if (query.trim()) {
      items.push({
        id: 'create',
        label: query.trim(),
        type: 'create',
        icon: Plus,
      })
    }
    // Search existing tasks
    const matched = tasks.filter(t =>
      t.title.toLowerCase().includes(query.toLowerCase()) && query.trim()
    ).slice(0, 5)
    matched.forEach(t => items.push({ id: t.id, label: t.title, type: 'task', status: t.status }))
    return items
  })()

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const executeItem = useCallback(async (item) => {
    if (!item) return
    if (item.type === 'create') {
      await addTask({ title: item.label })
      onClose()
    } else if (item.type === 'nav') {
      onNavigate?.(item.action)
      onClose()
    } else if (item.type === 'task') {
      onClose()
    } else if (item.type === 'tag') {
      onClose()
    }
  }, [addTask, onClose, onNavigate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      executeItem(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selectedIndex, executeItem, onClose])

  const getPrefix = () => {
    if (isNav) return { icon: CaretRight, hint: 'Navigate to...' }
    if (isTag) return { icon: Hash, hint: 'Filter by tag...' }
    return { icon: MagnifyingGlass, hint: 'Create task or search...' }
  }
  const prefix = getPrefix()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel — Raycast-style top-[20%] */}
          <div className="fixed inset-x-0 top-[18%] z-50 flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xl"
            >
              {/* Double-Bezel panel */}
              <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl overflow-hidden"
                style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

                {/* Input row */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/60">
                  <prefix.icon size={15} weight="bold" className="text-zinc-600 shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={prefix.hint}
                    className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
                  />
                  {query && (
                    <kbd className="text-[10px] font-mono text-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                      ↵ enter
                    </kbd>
                  )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <div className="py-1.5 max-h-72 overflow-y-auto">
                    {results.map((item, i) => (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => executeItem(item)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 cursor-pointer ${
                          i === selectedIndex ? 'bg-zinc-800/60' : 'hover:bg-zinc-800/40'
                        }`}
                      >
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-zinc-800">
                          {item.type === 'create' && <Plus size={11} weight="bold" className="text-blue-400" />}
                          {item.type === 'task' && <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'YAPPD' ? 'bg-emerald-500' :
                            item.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-zinc-600'
                          }`} />}
                          {item.type === 'nav' && <ArrowRight size={11} weight="bold" className="text-zinc-400" />}
                          {item.type === 'tag' && <Hash size={11} weight="bold" className="text-zinc-400" />}
                        </span>

                        <span className="flex-1 text-sm text-zinc-300 truncate">{item.label}</span>

                        {item.type === 'create' && (
                          <span className="text-[11px] text-zinc-600 shrink-0">Create task</span>
                        )}
                        {item.type === 'task' && (
                          <span className={`text-[10px] font-medium shrink-0 ${
                            item.status === 'YAPPD' ? 'text-emerald-600' :
                            item.status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-zinc-700'
                          }`}>
                            {item.status === 'IN_PROGRESS' ? 'In Progress' : item.status === 'YAPPD' ? 'Yappd' : 'To Do'}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {results.length === 0 && query && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-zinc-600">No results for "{query}"</p>
                    <p className="text-xs text-zinc-700 mt-1">Press Enter to create this task</p>
                  </div>
                )}

                {/* Footer hints */}
                {!query && (
                  <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center gap-4">
                    <span className="text-[10px] text-zinc-700"><kbd className="font-mono bg-zinc-800 px-1 rounded">&gt;</kbd> navigate</span>
                    <span className="text-[10px] text-zinc-700"><kbd className="font-mono bg-zinc-800 px-1 rounded">#</kbd> filter by tag</span>
                    <span className="text-[10px] text-zinc-700">type to create</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
