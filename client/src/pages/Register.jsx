import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkle } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'

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
    <div className="min-h-[100dvh] flex">

      {/* Left — branded panel */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-zinc-950 flex-col justify-between p-14 overflow-hidden border-r border-zinc-800">

        <div className="relative z-10">
          <span className="text-zinc-100 text-lg font-semibold tracking-tight">Yappd</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900">
            <Sparkle size={13} weight="fill" className="text-blue-400" />
            <span className="text-xs text-zinc-400 font-medium">Free during early access</span>
          </div>
          <h1 className="text-5xl font-semibold tracking-tighter leading-none text-zinc-100">
            Start shipping.<br />
            <span className="text-zinc-500">Stop juggling.</span>
          </h1>
          <p className="text-zinc-500 text-base leading-relaxed max-w-[42ch]">
            One workspace for tasks, projects, and an AI that keeps you two steps ahead.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {[
              'Kanban board with drag-and-drop',
              'AI sidebar with full task context',
              'Productivity analytics and streaks',
            ].map((feat, i) => (
              <motion.div
                key={feat}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3"
              >
                <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm text-zinc-400">{feat}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-zinc-700">Built with Claude Code</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 bg-zinc-950">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <p className="lg:hidden text-zinc-100 text-base font-semibold tracking-tight mb-10">Yappd</p>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-1">Create account</h2>
          <p className="text-sm text-zinc-500 mb-8">Get started in seconds</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 tracking-wide">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98, y: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-200 cursor-pointer"
            >
              {loading ? 'Creating account...' : (
                <>Create account <ArrowRight size={15} weight="bold" /></>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-sm text-zinc-600">
            Have an account?{' '}
            <Link to="/login" className="text-zinc-300 hover:text-zinc-100 font-medium transition-colors duration-150">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
