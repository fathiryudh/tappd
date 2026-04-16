import { motion } from 'framer-motion'
import { AUTH_COLORS } from './authTheme'

const MotionDiv = motion.div

export function AuthLayout({
  eyebrow,
  title,
  description,
  notes,
  sideLabel,
  formLabel,
  children,
}) {
  return (
    <div className="min-h-[100dvh] px-4 py-4 md:px-6 md:py-6" style={{ background: AUTH_COLORS.bg, color: AUTH_COLORS.text }}>
      <MotionDiv
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-[1440px] grid-cols-1 gap-10 md:min-h-[calc(100dvh-3rem)] xl:grid-cols-[minmax(420px,1.15fr)_minmax(0,0.85fr)] xl:gap-16 2xl:grid-cols-[minmax(480px,1.2fr)_minmax(0,0.8fr)]"
      >
        <aside className="xl:flex xl:border-r xl:pr-10" style={{ borderColor: AUTH_COLORS.line }}>
          <div className="flex h-full max-w-[540px] flex-col">
            <div className="pb-8 pt-4 xl:pt-8">
              <div className="text-[1.9rem] font-semibold leading-none tracking-[-0.07em]">Yappd</div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: AUTH_COLORS.muted }}>
                {sideLabel}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: AUTH_COLORS.muted }}>
                  {eyebrow}
                </div>
                <h1 className="mt-3 max-w-[11ch] text-[3rem] font-semibold leading-[0.9] tracking-[-0.09em] md:text-[4.1rem] 2xl:text-[4.6rem]">
                  {title}
                </h1>
                <p className="mt-5 max-w-[30rem] text-sm leading-7 md:text-base" style={{ color: AUTH_COLORS.muted }}>
                  {description}
                </p>
              </div>

              <div className="space-y-3 xl:max-w-[28rem]">
                {notes.map(note => (
                  <article
                    key={note.title}
                    className="rounded-[1.35rem] border px-4 py-4"
                    style={{ borderColor: AUTH_COLORS.line, background: 'rgba(255,255,255,0.72)' }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: AUTH_COLORS.muted }}>
                      {note.title}
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: AUTH_COLORS.text }}>
                      {note.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 xl:mt-auto xl:border-t" style={{ borderColor: AUTH_COLORS.line }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: AUTH_COLORS.muted }}>
                {formLabel}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 xl:flex xl:flex-col xl:justify-center xl:pl-2">
          <div className="flex min-h-full items-start xl:items-center xl:justify-end xl:pt-0">
            <div className="w-full max-w-[560px] pt-2 md:pt-4 xl:max-w-[500px] xl:pt-0">
              {children}
            </div>
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
