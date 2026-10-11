const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]
/** Beyond this, a plain date reads better to a kid than "6 days ago". */
const RELATIVE_CUTOFF_MS = 6 * 24 * 60 * 60 * 1000

/** "2h ago" / "3d ago" within six days, a short date beyond that ("Oct 3", or "Oct 3, 2025" in a past year). */
export function formatNotificationTime(iso: string): string {
  const date = new Date(iso)
  const elapsed = Date.now() - date.getTime()
  if (elapsed < 60_000) return 'just now'
  if (elapsed < RELATIVE_CUTOFF_MS) {
    for (const [unit, ms] of RELATIVE_UNITS) {
      if (Math.abs(elapsed) >= ms) return relativeFormatter.format(-Math.round(elapsed / ms), unit)
    }
  }
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
