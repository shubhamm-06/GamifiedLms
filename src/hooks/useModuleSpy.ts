import { useEffect, useState, type RefObject } from 'react'
import { stuckModuleBarBottom } from '@/lib/stickyTop'

interface SpyPosition {
  /** The module (`data-module-key`) the row under the reading line belongs to. */
  key: string
  /** That row's 1-based place within its module (`data-unit`). */
  unit: number
}

/**
 * Scroll-spy for the module bar: which module and which lesson are in view.
 * Each lesson row carries `data-module-key` and `data-unit`; the active row is
 * the topmost one whose centre is below a reading line 40% of the way down the
 * visible area under the stuck bar (easing to the bar's edge at the top of the
 * page and to the screen's bottom at the end of it), and the module is that
 * row's module, so the
 * module changes only at a module boundary while the unit changes lesson by
 * lesson. It listens to scroll and resize and re-runs when the set of modules
 * changes; work is throttled to one frame. `initial` is what the bar shows
 * until the child first scrolls by hand (wheel, touch, key or pointer): where
 * the page's own auto-scroll is taking them.
 */
export function useModuleSpy(
  ref: RefObject<HTMLElement | null>,
  initial: SpyPosition,
  depKey: string,
): SpyPosition {
  const [active, setActive] = useState<SpyPosition>(initial)
  const { key: initialKey, unit: initialUnit } = initial

  useEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0
    // Until the child first scrolls by hand, the bar keeps showing `initial`: the
    // page's own auto-scroll (to the next-up lesson) is what it should describe,
    // even where the end of the page keeps that lesson from reaching the line.
    let pinned = true

    const measure = () => {
      frame = 0
      if (pinned) return
      // Where the bar sits once stuck (the top bar's bottom edge plus its own
      // height), not where it happens to be in the flow before that. The line
      // the child is "looking at" is 40% of the way down from there, so the bar
      // also changes for a last module that never scrolls all the way up.
      const bar = root.querySelector<HTMLElement>('[data-module-bar]')
      const stuck = stuckModuleBarBottom(bar)
      const visible = window.innerHeight - stuck
      // The line eases to the stuck edge at the very top of the page and to the
      // bottom of the screen at the very bottom, so the first lesson reads as
      // Unit 1 before any scrolling and the last lessons (a short last module
      // above all) are reachable; in between it is the plain 40% line.
      const top = Math.min(1, window.scrollY / (visible * 0.4))
      const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY
      const bottom = 1 - Math.min(1, Math.max(0, remaining) / (visible * 0.6))
      const fraction = 0.4 * top + (1 - 0.4 * top) * bottom
      const line = stuck + visible * fraction
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-module-key]'))
      if (rows.length === 0) return
      const at = (row: HTMLElement): SpyPosition => ({
        key: row.dataset.moduleKey ?? initialKey,
        unit: Number(row.dataset.unit) || 1,
      })
      let next = at(rows[rows.length - 1])
      for (const row of rows) {
        const r = row.getBoundingClientRect()
        if (r.top + r.height / 2 > line) {
          next = at(row)
          break
        }
      }
      setActive((prev) => (prev.key === next.key && prev.unit === next.unit ? prev : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    const unpin = () => {
      pinned = false
      schedule()
    }
    const byHand = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    for (const type of byHand) window.addEventListener(type, unpin, { once: true, passive: true })
    schedule() // first measurement, after layout
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      for (const type of byHand) window.removeEventListener(type, unpin)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, initialKey, initialUnit, depKey])

  return active
}
