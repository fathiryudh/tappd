import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SquaresFour,
  Lightning,
  ChartLineUp,
  Gear,
  SignOut,
} from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { TaskProvider } from '../context/TaskContext'
import { useTasks } from '../hooks/useTasks'
import KanbanBoard from '../components/board/KanbanBoard'
import BoardHeader from '../components/header/BoardHeader'
import CommandPalette from '../components/palette/CommandPalette'
import QuickCaptureFAB from '../components/fab/QuickCaptureFAB'

const NAV_ITEMS = [
  { id: 'board',     icon: SquaresFour, label: 'Board' },
  { id: 'ai',        icon: Lightning,   label: 'AI Assistant' },
  { id: 'analytics', icon: ChartLineUp, label: 'Analytics' },
  { id: 'settings',  icon: Gear,        label: 'Settings' },
]

function DashboardInner() {
  const { user, logout } = useAuth()
  const { error, clearError } = useTasks()
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('board')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'YP'

  // Global ⌘K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-clear error toast
  useEffect(() => {
    if (error) {
      const t = setTimeout(clearError, 3000)
      return () => clearTimeout(t)
    }
  }, [error, clearError])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleNavigate = useCallback((action) => {
    const map = {
      'nav-board':     'board',
      'nav-ai':        'ai',
      'nav-analytics': 'analytics',
    }
    if (map[action]) setActiveNav(map[action])
  }, [])

  return (
    <div className="min-h-[100dvh] flex bg-zinc-950 text-zinc-100">

      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-zinc-800/50">
        {/* Wordmark */}
        <div className="px-5 py-5 border-b border-zinc-800/50">
          <span className="text-sm font-semibold tracking-tight text-zinc-100">Yappd</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                activeNav === id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/60'
              }`}
            >
              <Icon
                size={15}
                weight={activeNav === id ? 'fill' : 'regular'}
              />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-2.5 py-3 border-t border-zinc-800/50 space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-white">{initials}</span>
            </div>
            <span className="text-[11px] text-zinc-500 truncate flex-1">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/60 transition-all duration-150 cursor-pointer"
          >
            <SignOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <BoardHeader onPaletteOpen={() => setPaletteOpen(true)} />

        {/* Content */}
        <main className="flex-1 overflow-x-auto px-8 py-6">
          {activeNav === 'board' && <KanbanBoard />}

          {activeNav === 'ai' && (
            <ComingSoon
              title="AI Assistant"
              description="Your board context-aware assistant is coming in Phase 3."
              icon={Lightning}
            />
          )}
          {activeNav === 'analytics' && (
            <ComingSoon
              title="Analytics"
              description="Productivity charts and streak history land in Phase 4."
              icon={ChartLineUp}
            />
          )}
          {activeNav === 'settings' && (
            <ComingSoon
              title="Settings"
              description="Account preferences and integrations coming soon."
              icon={Gear}
            />
          )}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* FAB */}
      <QuickCaptureFAB />

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-red-950/90 border border-red-900/60 text-red-400 text-xs font-medium backdrop-blur-sm"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ComingSoon({ title, description, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center"
    >
      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
        <Icon size={18} weight="light" className="text-zinc-600" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-400 tracking-tight mb-1">{title}</h2>
      <p className="text-xs text-zinc-700 max-w-[28ch] leading-relaxed">{description}</p>
    </motion.div>
  )
}

export default function Dashboard() {
  return (
    <TaskProvider>
      <DashboardInner />
    </TaskProvider>
  )
}
