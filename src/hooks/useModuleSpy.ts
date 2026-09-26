import { useEffect, useState, type RefObject } from 'react'

/**
 * Scroll-spy for the module bar: which module's lessons are in view. Each
 * lesson row carries `data-module-key`; the active module is the one owning the
 * topmost row whose centre is below a reading line 40% of the way down the
 * visible area under the stuck bar. It listens to scroll and resize and
 * re-runs when the set of modules changes; work is throttled to one frame.
 * `initialKey` is the module shown before the first measurement.
 */
export function useModuleSpy(
  ref: RefObject<HTMLElement | null>,
  initialKey: string,
  depKey: string,
): string {
  const [active, setActive] = useState(initialKey)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0

    const measure = () => {
      frame = 0
      // Where the bar sits once stuck (the top bar's bottom edge plus its own
      // height), not where it happens to be in the flow before that. The line
      // the child is "looking at" is 40% of the way down from there, so the bar
      // also changes for a last module that never scrolls all the way up.
      const bar = root.querySelector<HTMLElement>('[data-module-bar]')
      const stuck = (document.querySelector('.kid-topbar')?.getBoundingClientRect().bottom ?? 0) + (bar?.offsetHeight ?? 0)
      const line = stuck + (window.innerHeight - stuck) * 0.4
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-module-key]'))
      if (rows.length === 0) return
      let key = rows[rows.length - 1].dataset.moduleKey ?? initialKey
      for (const row of rows) {
        const r = row.getBoundingClientRect()
        if (r.top + r.height / 2 > line) {
          key = row.dataset.moduleKey ?? key
          break
        }
      }
      setActive((prev) => (prev === key ? prev : key))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule() // first measurement, after layout
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, initialKey, depKey])

  return active
}
