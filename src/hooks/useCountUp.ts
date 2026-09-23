import { useEffect, useState } from 'react'
import { prefersReducedMotion } from './useMediaQuery'

/**
 * Animates a number from 0 to `target` over `durationMs` (spec Part B8: the
 * XP count-up). Eased with a standard curve, so it settles smoothly; the
 * component pairs this with a CSS pop on the number's container for the
 * overshoot at the end, rather than overshooting the numeric value itself
 * (a count that briefly shows more XP than was earned would be confusing).
 * Skipped under reduced motion, or while inactive, or for a non-positive
 * target: the final value is returned immediately, with no animation loop.
 */
export function useCountUp(target: number, durationMs = 600, active = true): number {
  const animate = active && target > 0 && !prefersReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now()
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(ease(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, target, durationMs])

  return animate ? value : target
}
