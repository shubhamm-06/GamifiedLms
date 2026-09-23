import type { CSSProperties } from 'react'
import { prefersReducedMotion } from '@/hooks/useMediaQuery'

const COLORS = ['var(--gold)', 'var(--teal)', 'var(--coral)', 'var(--plum)']
const COUNT = 24
// The golden angle spreads points around a circle with no visible repeat,
// so the burst looks scattered without any call to Math.random() (render
// must stay pure — see the earlier, reverted useMemo/useEffect attempts).
const GOLDEN_ANGLE = 2.399963229728653

/**
 * A short burst behind the completion medallion (spec Part B8): up to 40 CSS
 * pieces (24 here), positioned and coloured by inline custom properties, gone
 * within about 1.1s. No canvas, no new dependency, and no randomness: the
 * layout is a fixed, deterministic spread (the golden angle), which looks
 * scattered without calling an impure function during render. Removed
 * entirely under `prefers-reduced-motion`.
 */
export function Confetti() {
  if (prefersReducedMotion()) return null
  return (
    <span className="lp-confetti" aria-hidden="true" data-testid="confetti">
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = i * GOLDEN_ANGLE
        const dist = 70 + ((i * 37) % 50)
        const style = {
          '--pc': COLORS[i % COLORS.length],
          '--dx': `${Math.cos(angle) * dist}px`,
          '--dy': `${Math.sin(angle) * dist}px`,
          '--dr': `${(i * 53) % 360}deg`,
          '--pd': `${(i % 6) * 0.03}s`,
        } as CSSProperties
        return <span key={i} className="lp-confetti-piece" style={style} />
      })}
    </span>
  )
}
