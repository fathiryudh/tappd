import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Lightning, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'

const floatingTasks = [
  { label: 'Finalize API design', tag: 'Backend', done: true },
  { label: 'Review pull request #42', tag: 'Dev', done: false },
  { label: 'Write onboarding copy', tag: 'Content', done: true },
  { label: 'Set up CI pipeline', tag: 'DevOps', done: false },
  { label: 'Deploy to staging', tag: 'Infra', done: true },
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
    <div className="min-h-[100dvh] flex">

      {/* Left — branded panel */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-zinc-950 flex-col justify-between p-14 overflow-hidden border-r border-zinc-800">

        {/* Noise grain overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px' }}
        />

        {/* Wordmark */}
        <div className="relative z-10">
          <span className="text-zinc-100 text-lg font-semibold tracking-tight">Yappd</span>
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-6">
          <p className="text-xs font-medium tracking-widest text-blue-400 uppercase">AI Productivity</p>
          <h1 className="text-5xl font-semibold tracking-tighter leading-none text-zinc-100">
            Tasks managed.<br />
            <span className="text-zinc-500">Nothing slips.</span>
          </h1>
          <p className="text-zinc-500 text-base leading-relaxed max-w-[42ch]">
            A Kanban board that understands context. An AI that knows what's next.
          </p>

          {/* Floating task cards */}
          <div className="mt-8 space-y-2.5">
            {floatingTasks.map((task, i) => (
              <motion.div
                key={task.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 group"
              >
                {task.done
                  ? <CheckCircle size={15} weight="fill" className="text-blue-500 shrink-0" />
                  : <ArrowsClockwise size={15} weight="bold" className="text-zinc-600 shrink-0" />
                }
                <span className={`text-sm tracking-tight ${task.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                  {task.label}
                </span>
                <span className="ml-auto text-[11px] font-medium text-zinc-700 border border-zinc-800 px-1.5 py-0.5 rounded">
                  {task.tag}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2">
          <Lightning size={13} weight="fill" className="text-blue-500" />
          <span className="text-xs text-zinc-600">Phase 1 — Auth complete</span>
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
          {/* Mobile wordmark */}
          <p className="lg:hidden text-zinc-100 text-base font-semibold tracking-tight mb-10">Yappd</p>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-1">Sign in</h2>
          <p className="text-sm text-zinc-500 mb-8">Continue to your workspace</p>

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

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98, y: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-200 cursor-pointer"
            >
              {loading ? 'Signing in...' : (
                <>Sign in <ArrowRight size={15} weight="bold" /></>
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-sm text-zinc-600">
            No account?{' '}
            <Link to="/register" className="text-zinc-300 hover:text-zinc-100 font-medium transition-colors duration-150">
              Register
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
