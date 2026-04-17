import { useMotionValue, useMotionTemplate } from 'framer-motion'

const dotPattern = (color) => ({
  backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
  backgroundSize: '18px 18px',
})

export function HeroHighlight({ children, className = '', containerClassName = '' }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <div
      className={`relative flex items-center justify-center w-full group ${containerClassName}`}
      onMouseMove={handleMouseMove}
    >
      {/* static dot layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={dotPattern('rgba(0,0,0,0.08)')}
      />

      {/* mouse-tracked highlight layer */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          ...dotPattern('rgba(99,102,241,0.55)'),
          WebkitMaskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
          maskImage: useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
        }}
      />

      <div className={`relative z-10 ${className}`}>{children}</div>
    </div>
  )
}

export function Highlight({ children, className = '' }) {
  return (
    <motion.span
      initial={{ backgroundSize: '0% 100%' }}
      animate={{ backgroundSize: '100% 100%' }}
      transition={{ duration: 1.8, ease: 'linear', delay: 0.4 }}
      style={{
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left center',
        display: 'inline',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
      }}
      className={`relative inline pb-0.5 px-1 rounded-md bg-gradient-to-r from-indigo-200 to-violet-200 ${className}`}
    >
      {children}
    </motion.span>
  )
}
