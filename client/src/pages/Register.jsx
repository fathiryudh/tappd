import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { AuthError, AuthField, AuthLayout } from './auth/AuthLayout'
import { AUTH_COLORS } from './auth/authTheme'

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
    <AuthLayout>
      <div className="rounded-[1.5rem] border px-5 py-6 md:px-7 md:py-7" style={{ borderColor: AUTH_COLORS.line, background: 'rgba(255,255,255,0.68)' }}>
        <h2 className="text-[2rem] font-semibold tracking-[-0.06em]">Create workspace</h2>
        <p className="mt-1.5 text-sm" style={{ color: AUTH_COLORS.muted }}>
          Set up your admin account.
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

          <AuthField label="Confirm password">
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            <span>{loading ? 'Creating account…' : 'Create workspace'}</span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-700 group-hover:translate-x-1 group-hover:-translate-y-[1px]"
              style={{ background: 'rgba(255,255,255,0.14)', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}
            >
              <ArrowRight size={16} weight="bold" />
            </span>
          </button>
        </form>

        <p className="mt-6 text-sm" style={{ color: AUTH_COLORS.muted }}>
          Have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: AUTH_COLORS.text }}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
