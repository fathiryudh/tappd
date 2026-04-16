import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { AuthError, AuthField, AuthLayout } from './auth/AuthLayout'
import { AUTH_COLORS } from './auth/authTheme'

const NOTES = [
  {
    title: 'Telegram-native reporting',
    body: 'Officers report attendance from Telegram while admin work stays in the dashboard.',
  },
  {
    title: 'Live roster updates',
    body: 'Status events appear inside the dashboard as officers report or edit their availability.',
  },
  {
    title: 'Focused operations view',
    body: 'Roster, attendance, and notifications share one quieter administrative surface.',
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
    <AuthLayout
      eyebrow="Admin access"
      title="Sign in."
      description="Use your admin account to continue to the operations dashboard."
      notes={NOTES}
      sideLabel="Admin"
      formLabel="Dashboard • Roster • Notifications"
    >
      <div className="rounded-[1.5rem] border px-5 py-6 md:px-7 md:py-7" style={{ borderColor: AUTH_COLORS.line, background: 'rgba(255,255,255,0.68)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: AUTH_COLORS.muted }}>
          Admin access
        </div>
        <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.06em]">Continue to dashboard</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: AUTH_COLORS.muted }}>
          Sign in with the admin account that owns this workspace.
        </p>

        {error && (
          <div className="mt-6">
            <AuthError>{error}</AuthError>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <AuthField label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-slate-400"
            />
          </AuthField>

          <AuthField label="Password">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-slate-400"
            />
          </AuthField>

          <button
            type="submit"
            disabled={loading}
            className="group inline-flex w-full items-center justify-between rounded-full px-5 py-3.5 text-sm font-medium text-white transition-all duration-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            style={{ background: AUTH_COLORS.info, transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
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

        <p className="mt-6 text-sm" style={{ color: AUTH_COLORS.muted }}>
          Need an admin account?{' '}
          <Link to="/register" className="font-medium" style={{ color: AUTH_COLORS.text }}>
            Register
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
