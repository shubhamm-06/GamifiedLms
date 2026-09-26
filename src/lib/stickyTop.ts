/**
 * The y of the bottom edge of everything stuck to the top of the viewport
 * below the safe area: the kid top bar and, on Home, the stat bar under it.
 * The module bar sticks to this edge, so scroll-spy and the popover measure
 * from it instead of hardcoding what sits above.
 */
export function stickyTopEdge(): number {
  const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0
  return Math.max(bottom('.kid-topbar'), bottom('.kid-statbar'))
}
