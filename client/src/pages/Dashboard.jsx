import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarBlank,
  Checks,
  SignOut,
  UserCircle,
  Users,
  X,
} from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { fetchNotifications, markAllNotificationsRead } from '../api/notifications.api'
import { fetchOfficerFormOptions } from '../api/officers.api'
import OfficerList from '../components/roster/OfficerList'
import RosterView from '../components/roster/RosterView'

const PINNED_FILTER_KEY = 'yappd_pinned_filter'

const MotionDiv = motion.div
const MotionAside = motion.aside
const MotionMain = motion.main

const COLORS = {
  bg: '#F7F7F5',
  shell: 'rgba(0, 0, 0, 0.03)',
  surface: '#FFFFFF',
  soft: 'rgba(0,0,0,0.03)',
  line: 'rgba(0, 0, 0, 0.06)',
  lineStrong: 'rgba(0, 0, 0, 0.10)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#111111',
  info: '#111111',
  infoSoft: 'rgba(0,0,0,0.04)',
  brandSoft: 'rgba(0,0,0,0.04)',
}

const NAV_ITEMS = [
  { id: 'attendance', icon: CalendarBlank, label: 'Attendance', eyebrow: 'Weekly view' },
  { id: 'roster', icon: Users, label: 'Roster', eyebrow: 'Directory' },
]

const toastLifetimeMs = 4200

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('attendance')
  const [attendanceRefreshToken, setAttendanceRefreshToken] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationState, setNotificationState] = useState({ items: [], unreadCount: 0 })
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [liveToasts, setLiveToasts] = useState([])
  const [divisions, setDivisions] = useState([])
  const [branches, setBranches] = useState([])
  const [filter, setFilter] = useState(() => {
    try {
      const raw = localStorage.getItem(PINNED_FILTER_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { divisionId: '', branchId: '' }
  })
  const [pinnedFilter, setPinnedFilter] = useState(() => {
    try {
      const raw = localStorage.getItem(PINNED_FILTER_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
  })
  const [fabOpen, setFabOpen] = useState(false)
  const panelRef = useRef(null)
  const fabRef = useRef(null)
  const seenNotificationIdsRef = useRef(new Set())
  const toastTimersRef = useRef(new Map())
  const initializedRef = useRef(false)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    const toastTimers = toastTimersRef.current

    const dismissToast = (toastId) => {
      setLiveToasts(prev => prev.filter(item => item.toastId !== toastId))
      const timer = toastTimers.get(toastId)
      if (timer) {
        clearTimeout(timer)
        toastTimers.delete(toastId)
      }
    }

    const pushLiveToasts = (items) => {
      const nextToasts = items.slice(0, 3).map(item => ({
        toastId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item,
      }))

      setLiveToasts(prev => [...nextToasts, ...prev].slice(0, 4))

      nextToasts.forEach(toast => {
        const timer = setTimeout(() => dismissToast(toast.toastId), toastLifetimeMs)
        toastTimers.set(toast.toastId, timer)
      })
    }

    const loadNotifications = async ({ silent = false } = {}) => {
      if (!silent) setLoadingNotifications(true)

      try {
        const data = await fetchNotifications()
        if (!alive) return

        const unseenItems = data.items.filter(item => !seenNotificationIdsRef.current.has(item.id))
        data.items.forEach(item => seenNotificationIdsRef.current.add(item.id))

        if (initializedRef.current && unseenItems.length > 0) {
          pushLiveToasts(unseenItems)
          setAttendanceRefreshToken(prev => prev + unseenItems.length)
        }

        initializedRef.current = true
        setNotificationState(data)
      } finally {
        if (alive && !silent) setLoadingNotifications(false)
      }
    }

    loadNotifications()
    const interval = setInterval(() => loadNotifications({ silent: true }), 15000)

    return () => {
      alive = false
      clearInterval(interval)
      toastTimers.forEach(timer => clearTimeout(timer))
      toastTimers.clear()
    }
  }, [])

  useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [notificationsOpen])

  useEffect(() => {
    if (!fabOpen) return

    const handlePointerDown = (event) => {
      if (fabRef.current && !fabRef.current.contains(event.target)) {
        setFabOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [fabOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleMarkAllRead = async () => {
    if (notificationState.unreadCount === 0) return
    setMarkingAllRead(true)
    try {
      await markAllNotificationsRead()
      setNotificationState(prev => ({
        unreadCount: 0,
        items: prev.items.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
      }))
    } finally {
      setMarkingAllRead(false)
    }
  }

  useEffect(() => {
    fetchOfficerFormOptions().then((opts) => {
      setDivisions(opts.divisions || [])
      setBranches(opts.branches || [])
    }).catch(() => {})
  }, [])

  const handlePin = () => {
    localStorage.setItem(PINNED_FILTER_KEY, JSON.stringify(filter))
    setPinnedFilter({ ...filter })
  }

  const handleUnpin = () => {
    localStorage.removeItem(PINNED_FILTER_KEY)
    setPinnedFilter(null)
  }

  return (
    <div className="h-[100dvh] overflow-hidden px-4 py-4 md:px-6 md:py-6" style={{ background: COLORS.bg, color: COLORS.text }}>

      <MotionDiv
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto grid h-full max-w-[1440px] grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]"
      >
        <aside className="xl:pr-6 xl:border-r xl:overflow-y-auto" style={{ borderColor: COLORS.line }}>
          <div className="flex h-full flex-col">
            <div className="pb-8 pt-4">
              <div className="text-[1.9rem] font-semibold leading-none tracking-[-0.07em]">Yappd</div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: COLORS.muted }}>
                Admin
              </div>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map(item => {
                const IconComponent = item.icon
                const isActive = activeNav === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-200"
                    style={{
                      background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                      color: isActive ? 'rgba(0,0,0,0.88)' : COLORS.muted,
                    }}
                  >
                    <IconComponent size={18} weight={isActive ? 'fill' : 'regular'} />
                    <span className="text-sm font-medium tracking-[-0.02em]">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="mt-8 hidden pt-6 xl:mt-auto xl:block xl:border-t" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-3">
                <UserCircle size={18} weight="regular" style={{ color: COLORS.muted }} />
                <div className="min-w-0 truncate text-sm">{user?.email || 'Admin user'}</div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200"
                style={{ background: COLORS.soft, color: 'rgba(0,0,0,0.72)' }}
              >
                <SignOut size={15} weight="regular" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>

        <MotionMain
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 h-full min-h-0"
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-end pb-2">
                <div className="relative self-start" ref={panelRef}>
                  <button
                    onClick={() => setNotificationsOpen(open => !open)}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200"
                    style={{
                      background: notificationsOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                      color: 'rgba(0,0,0,0.72)',
                    }}
                  >
                    {notificationsOpen ? <X size={16} weight="regular" /> : <Bell size={16} weight="regular" />}
                    <span>{notificationState.unreadCount > 0 ? `${notificationState.unreadCount} unread` : 'Notifications'}</span>
                  </button>

                  <AnimatePresence>
                    {notificationsOpen && (
                      <MotionDiv
                        initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 z-20 mt-3 w-[min(92vw,28rem)] rounded-[1.5rem] border bg-white p-4"
                        style={{ borderColor: COLORS.line, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
                      >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
                                Recent updates
                              </div>
                              <div className="mt-1 text-lg font-semibold tracking-[-0.04em]">Officer status events</div>
                            </div>
                            <button
                              onClick={handleMarkAllRead}
                              disabled={markingAllRead || notificationState.unreadCount === 0}
                              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors duration-200 disabled:opacity-45"
                              style={{ background: COLORS.soft, color: COLORS.text }}
                            >
                              <Checks size={14} weight="light" />
                              {markingAllRead ? 'Marking…' : 'Mark all read'}
                            </button>
                          </div>

                          <div className="mt-4 max-h-[26rem] space-y-3 overflow-auto pr-1">
                            {loadingNotifications ? (
                              <NotificationEmpty label="Loading updates…" muted />
                            ) : notificationState.items.length === 0 ? (
                              <NotificationEmpty label="No officer updates yet." />
                            ) : (
                              notificationState.items.map(item => (
                                <article
                                  key={item.id}
                                  className="rounded-[1rem] border px-4 py-4"
                                  style={{ background: item.readAt ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)', borderColor: COLORS.line }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold tracking-[-0.02em]">{item.title}</div>
                                        <p className="mt-1 text-sm leading-6" style={{ color: COLORS.muted }}>
                                          {item.message}
                                        </p>
                                      </div>
                                      {!item.readAt && (
                                        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: COLORS.info }} />
                                      )}
                                    </div>
                                    <div className="mt-3 text-[11px] uppercase tracking-[0.18em]" style={{ color: COLORS.muted }}>
                                      {formatEventTime(item.createdAt)}
                                    </div>
                                </article>
                              ))
                            )}
                          </div>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto pt-4">
              {activeNav === 'roster' && (
                <OfficerList
                  filter={filter}
                  onFilterChange={setFilter}
                  divisions={divisions}
                  branches={branches}
                  pinnedFilter={pinnedFilter}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              )}
              {activeNav === 'attendance' && (
                <RosterView
                  refreshToken={attendanceRefreshToken}
                  filter={filter}
                  onFilterChange={setFilter}
                  divisions={divisions}
                  branches={branches}
                  pinnedFilter={pinnedFilter}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              )}
            </div>
          </div>
        </MotionMain>
      </MotionDiv>

      <div className="fixed bottom-6 right-4 z-40 xl:hidden" ref={fabRef}>
        <AnimatePresence>
          {fabOpen && (
            <MotionDiv
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-14 right-0 mb-2 w-64 rounded-2xl border bg-white p-4"
              style={{ borderColor: COLORS.line, boxShadow: '0 12px 30px rgba(0,0,0,0.10)' }}
            >
              <div className="flex items-center gap-3">
                <UserCircle size={18} weight="regular" style={{ color: COLORS.muted }} />
                <div className="min-w-0 truncate text-sm">{user?.email || 'Admin user'}</div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors duration-200"
                style={{ background: COLORS.soft, color: 'rgba(0,0,0,0.72)' }}
              >
                <SignOut size={15} weight="regular" />
                <span>Sign out</span>
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>
        <button
          onClick={() => setFabOpen(open => !open)}
          className="flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200"
          style={{
            background: fabOpen ? 'rgba(0,0,0,0.10)' : COLORS.brand,
            color: fabOpen ? COLORS.text : '#FFFFFF',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          }}
        >
          {fabOpen ? <X size={20} weight="bold" /> : <UserCircle size={22} weight="fill" />}
        </button>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex w-[min(92vw,24rem)] flex-col gap-3">
        <AnimatePresence initial={false}>
          {liveToasts.map(({ toastId, item }) => (
            <MotionAside
              key={toastId}
              initial={{ opacity: 0, x: 28, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 24, y: -8 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className="pointer-events-auto rounded-[1.5rem] p-1.5"
              style={{ background: 'rgba(15,23,42,0.08)', boxShadow: '0 18px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(148,163,184,0.14)' }}
            >
              <div className="flex gap-3 rounded-[calc(1.5rem-0.375rem)] bg-white px-4 py-4">
                <div className="mt-1 h-10 w-1 rounded-full" style={{ background: COLORS.info }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.info }}>
                    Live update
                  </div>
                  <div className="mt-1 text-sm font-semibold tracking-[-0.02em]">{item.title}</div>
                  <p className="mt-1 text-sm leading-6" style={{ color: COLORS.muted }}>
                    {item.message}
                  </p>
                </div>
              </div>
            </MotionAside>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function NotificationEmpty({ label, muted = false }) {
  return (
    <div
      className="rounded-[1.35rem] p-1.5"
      style={{ background: 'rgba(15,23,42,0.04)', boxShadow: '0 0 0 1px rgba(148,163,184,0.14)' }}
    >
      <div
        className="rounded-[calc(1.35rem-0.375rem)] px-4 py-6 text-sm"
        style={{ background: '#FFFFFF', color: muted ? COLORS.muted : COLORS.text }}
      >
        {label}
      </div>
    </div>
  )
}

function formatEventTime(value) {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.max(Math.round(diffMs / 60000), 0)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`

  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hr ago`

  return date.toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
