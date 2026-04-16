export const ROSTER_COLORS = {
  shell: 'rgba(0, 0, 0, 0.03)',
  surface: '#FFFFFF',
  soft: '#F5F5F2',
  line: 'rgba(0, 0, 0, 0.06)',
  lineStrong: 'rgba(0, 0, 0, 0.10)',
  text: '#0F172A',
  muted: 'rgba(0,0,0,0.45)',
  brand: '#111111',
  info: '#111111',
  infoSoft: 'rgba(0,0,0,0.04)',
  success: '#265D47',
  successSoft: '#EDF7F0',
  warning: '#9A6700',
  warningSoft: '#FFF6DB',
  danger: '#9B3B36',
  dangerSoft: '#FCEDED',
}

const DEFAULT_REVEAL_EASING = 'cubic-bezier(0.32,0.72,0,1)'

export function getRevealStyle(revealed, { distance = 12, delay = 0, duration = 600 } = {}) {
  const transition = `opacity ${duration}ms ${DEFAULT_REVEAL_EASING} ${delay}ms, transform ${duration}ms ${DEFAULT_REVEAL_EASING} ${delay}ms`

  return {
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translateY(0)' : `translateY(${distance}px)`,
    transition,
  }
}
