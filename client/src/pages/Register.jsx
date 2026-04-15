import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Rows, ShieldCheck, UsersThree } from '@phosphor-icons/react'
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
    icon: UsersThree,
    title: 'Admin-owned officer records',
    body: 'Each admin workspace owns its officers, divisions, branches, and notification feed.',
  },
  {
    icon: Rows,
    title: 'Weekly attendance oversight',
    body: 'The dashboard stays focused on routine operational review instead of general-purpose admin clutter.',
  },
  {
    icon: ShieldCheck,
    title: 'Authenticated admin access',
    body: 'Sessions are scoped to the signed-in admin so roster actions remain contained and auditable.',
  },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await register(email, password)
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
        className="pointer-events-none fixed inset-0 opacity-[0.52]"
        style={{
          background:
            'radial-gradient(circle at 82% 10%, rgba(89,37,220,0.11), transparent 24%), radial-gradient(circle at 18% 18%, rgba(31,105,255,0.08), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.64), rgba(245,247,251,0.96))',
        }}
      />

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto grid max-w-[1440px] grid-cols-1 gap-6 lg:min-h-[calc(100dvh-3rem)] lg:grid-cols-[0.92fr_1.08fr]"
      >
        <section className="flex items-center">
          <div
            className="w-full rounded-[2rem] p-2"
            style={{ background: COLORS.shell, boxShadow: '0 0 0 1px rgba(255,255,255,0.4)' }}
          >
            <div
              className="rounded-[calc(2rem-0.5rem)] px-6 py-8 md:px-8 md:py-10"
              style={{ background: 'rgba(255,255,255,0.94)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)' }}
            >
              <div className="max-w-[430px]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: COLORS.brand }}>
                  Create admin
                </div>
                <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em]">Open a workspace</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: COLORS.muted }}>
                  Create the admin account that owns officers, attendance views, and live notification events.
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

                  <Field label="Confirm password">
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
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
                    <span>{loading ? 'Creating account…' : 'Create workspace'}</span>
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-700 group-hover:translate-x-1 group-hover:-translate-y-[1px]"
                      style={{ background: 'rgba(255,255,255,0.14)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
                    >
                      <ArrowRight size={16} weight="bold" />
                    </span>
                  </button>
                </form>

                <p className="mt-6 text-sm" style={{ color: COLORS.muted }}>
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium" style={{ color: COLORS.text }}>
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>

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
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: COLORS.muted }}>
              Administrative setup
            </div>
            <div className="mt-4 max-w-[11ch] text-[2.8rem] font-semibold leading-[0.92] tracking-[-0.08em] md:text-[4.4rem]">
              Built for the team managing the roster.
            </div>
            <p className="mt-6 max-w-[38rem] text-base leading-7 md:text-lg" style={{ color: COLORS.muted }}>
              The admin workspace is intentionally structured around operational routines, not generic administration patterns.
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

            <div className="mt-auto pt-10 text-xs uppercase tracking-[0.18em]" style={{ color: 'rgba(71,85,105,0.72)' }}>
              Officers • Attendance • Notifications
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
