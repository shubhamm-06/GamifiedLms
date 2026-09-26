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

/**
 * The y of the bottom edge of the module bar once it is stuck: its computed
 * sticky `top` (the bars above it plus its own gap) plus its height. Falls back
 * to the bars above when there is no module bar.
 */
export function stuckModuleBarBottom(bar: HTMLElement | null | undefined): number {
  if (!bar) return stickyTopEdge()
  return (parseFloat(getComputedStyle(bar).top) || stickyTopEdge()) + bar.offsetHeight
}
