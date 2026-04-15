import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BellSimpleRinging, CalendarBlank, ChatsTeardrop } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'

const MotionDiv = motion.div

const COLORS = {
  bg: '#F5F7FB',
  shell: 'rgba(15, 23, 42, 0.06)',
  surface: '#FFFFFF',
  soft: '#F8FAFC',
  line: 'rgba(148, 163, 184, 0.22)',
  text: '#0F172A',
  muted: '#475569',
  brand: '#5925DC',
  info: '#1F69FF',
  infoSoft: '#EBF1FF',
  brandSoft: '#F3EDFF',
  danger: '#D7260F',
}

const NOTES = [
  {
    icon: ChatsTeardrop,
    title: 'Telegram-native reporting',
    body: 'Officers update attendance from chat instead of coming through the web dashboard.',
  },
  {
    icon: BellSimpleRinging,
    title: 'Live notification feed',
    body: 'Admin users receive fresh status events inside the dashboard as reporting happens.',
  },
  {
    icon: CalendarBlank,
    title: 'Weekly operational view',
    body: 'Roster maintenance and attendance review stay readable across daily and weekly workflows.',
  },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6" style={{ background: COLORS.bg, color: COLORS.text }}>
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.55]"
        style={{
          background:
            'radial-gradient(circle at 18% 16%, rgba(89,37,220,0.12), transparent 26%), radial-gradient(circle at 84% 12%, rgba(31,105,255,0.10), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.65), rgba(245,247,251,0.94))',
        }}
      />

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-6 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <section
          className="rounded-[2rem] p-2"
          style={{ background: COLORS.shell, boxShadow: '0 0 0 1px rgba(255,255,255,0.4)' }}
        >
          <div
            className="flex h-full flex-col rounded-[calc(2rem-0.5rem)] px-6 py-8 md:px-8 md:py-10 lg:px-10"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ background: COLORS.brandSoft, color: COLORS.brand }}
                >
                  Yappd
                </div>
                <div className="mt-4 max-w-[12ch] text-[2.9rem] font-semibold leading-[0.9] tracking-[-0.08em] md:text-[4.8rem]">
                  Daily reporting, made precise.
                </div>
              </div>

              <div
                className="hidden rounded-[1.5rem] p-1.5 md:block"
                style={{ background: 'rgba(15, 23, 42, 0.04)', boxShadow: '0 0 0 1px rgba(148,163,184,0.14)' }}
              >
                <div
                  className="rounded-[calc(1.5rem-0.375rem)] px-4 py-4"
                  style={{ background: 'rgba(255,255,255,0.88)' }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.muted }}>
                    Attendance cadence
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.05em]">07:30 / 08:30</div>
                </div>
              </div>
            </div>

            <div className="py-12 md:py-16 lg:py-24">
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ background: COLORS.infoSoft, color: COLORS.info }}
              >
                SCDF 2 Div HQ
              </div>
              <p className="mt-6 max-w-[38rem] text-base leading-7 md:text-lg" style={{ color: COLORS.muted, textWrap: 'pretty' }}>
                A quieter administrative interface for Telegram attendance, officer records, and live roster notifications.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {NOTES.map((item, index) => {
                  const IconComponent = item.icon
                  return (
                    <MotionDiv
                      key={item.title}
                      initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 0.62, delay: 0.12 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-[1.5rem] p-1.5"
                      style={{ background: 'rgba(15,23,42,0.04)', boxShadow: '0 0 0 1px rgba(148,163,184,0.14)' }}
                    >
                      <article className="h-full rounded-[calc(1.5rem-0.375rem)] px-5 py-5" style={{ background: 'rgba(255,255,255,0.86)' }}>
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-[1rem]"
                          style={{ background: COLORS.infoSoft, color: COLORS.info }}
                        >
                          <IconComponent size={18} weight="light" />
                        </div>
                        <h2 className="mt-4 text-sm font-semibold tracking-[-0.02em]">{item.title}</h2>
                        <p className="mt-2 text-sm leading-6" style={{ color: COLORS.muted }}>
                          {item.body}
                        </p>
                      </article>
                    </MotionDiv>
                  )
                })}
              </div>
            </div>

            <div className="mt-auto text-xs uppercase tracking-[0.18em]" style={{ color: 'rgba(71,85,105,0.72)' }}>
              Dashboard • Roster • Notifications
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div
            className="w-full rounded-[2rem] p-2"
            style={{ background: COLORS.shell, boxShadow: '0 0 0 1px rgba(255,255,255,0.4)' }}
          >
            <div
              className="rounded-[calc(2rem-0.5rem)] px-6 py-8 md:px-8 md:py-10"
              style={{
                background: 'rgba(255,255,255,0.94)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
              }}
            >
              <div className="max-w-[430px]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: COLORS.muted }}>
                  Admin access
                </div>
                <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em]">Sign in</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: COLORS.muted }}>
                  Use your admin account to continue to the operations dashboard.
                </p>

                {error && (
                  <div
                    className="mt-6 rounded-[1.25rem] p-1.5"
                    style={{ background: 'rgba(215,38,15,0.08)', boxShadow: '0 0 0 1px rgba(215,38,15,0.14)' }}
                  >
                    <div className="rounded-[calc(1.25rem-0.375rem)] px-4 py-3 text-sm" style={{ background: 'rgba(255,255,255,0.84)', color: COLORS.danger }}>
                      {error}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-slate-400"
                    />
                  </Field>

                  <Field label="Password">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-slate-400"
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex w-full items-center justify-between rounded-full px-5 py-3.5 text-sm font-medium text-white transition-all duration-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                    style={{ background: COLORS.info, transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                  >
                    <span>{loading ? 'Signing in…' : 'Continue'}</span>
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-700 group-hover:translate-x-1 group-hover:-translate-y-[1px]"
                      style={{ background: 'rgba(255,255,255,0.14)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                    >
                      <ArrowRight size={16} weight="bold" />
                    </span>
                  </button>
                </form>

                <p className="mt-6 text-sm" style={{ color: COLORS.muted }}>
                  Need an admin account?{' '}
                  <Link to="/register" className="font-medium" style={{ color: COLORS.text }}>
                    Register
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </MotionDiv>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-medium" style={{ color: COLORS.text }}>
        {label}
      </span>
      <div
        className="rounded-[1.4rem] p-1.5"
        style={{ background: 'rgba(15,23,42,0.04)', boxShadow: '0 0 0 1px rgba(148,163,184,0.14)' }}
      >
        <div className="overflow-hidden rounded-[calc(1.4rem-0.375rem)]" style={{ background: COLORS.soft }}>
          {children}
        </div>
      </div>
    </label>
  )
}
