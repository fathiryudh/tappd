import { motion } from 'framer-motion'
import { AUTH_COLORS } from './authTheme'
import { HeroHighlight, Highlight } from '../../components/ui/HeroHighlight'

const MotionDiv = motion.div

export function AuthLayout({ children }) {
  return (
    <div style={{ background: AUTH_COLORS.bg, color: AUTH_COLORS.text }}>
      <MotionDiv
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1440px] 2xl:max-w-[1920px] flex flex-col xl:grid xl:h-[100dvh] xl:grid-cols-[minmax(420px,1.15fr)_minmax(0,0.85fr)]"
      >
        {/* Hero panel — compact banner on mobile/tablet, full column on desktop */}
        <aside
          className="overflow-hidden xl:border-r"
          style={{ borderColor: AUTH_COLORS.line }}
        >
          <HeroHighlight containerClassName="py-10 xl:h-full w-full">
            <div className="flex flex-col items-center text-center px-6 xl:px-10">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: [20, -4, 0] }}
                transition={{ duration: 0.55, ease: [0.4, 0.0, 0.2, 1] }}
                className="text-[2.8rem] sm:text-[3.5rem] xl:text-[4rem] 2xl:text-[5.5rem] font-semibold leading-none tracking-[-0.08em]"
                style={{ color: AUTH_COLORS.text }}
              >
                Yappd
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="mt-4 text-sm 2xl:text-base leading-6 2xl:leading-7"
                style={{ color: AUTH_COLORS.muted, maxWidth: '32ch' }}
              >
                Stop chasing attendance. Yappd lets officers report instantly via Telegram—giving admins everything they need in one place:{' '}
                <Highlight>a live dashboard, weekly tracking, and full roster control.</Highlight>
              </motion.p>
            </div>
          </HeroHighlight>
        </aside>

        {/* Form panel */}
        <main className="px-4 py-8 md:px-8 xl:flex xl:items-center xl:justify-center xl:pl-10 xl:pr-6">
          <div className="w-full max-w-[500px] 2xl:max-w-[580px] mx-auto">
            {children}
          </div>
        </main>
      </MotionDiv>
    </div>
  )
}

export function AuthField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-medium" style={{ color: AUTH_COLORS.text }}>
        {label}
      </span>
      <div
        className="overflow-hidden rounded-[1rem] border"
        style={{ borderColor: AUTH_COLORS.line, background: 'rgba(255,255,255,0.82)' }}
      >
        {children}
      </div>
    </label>
  )
}

export function AuthError({ children }) {
  return (
    <div
      className="rounded-[1rem] border px-4 py-3 text-sm"
      style={{ borderColor: 'rgba(155,59,54,0.18)', background: AUTH_COLORS.dangerSoft, color: AUTH_COLORS.danger }}
    >
      {children}
    </div>
  )
}
