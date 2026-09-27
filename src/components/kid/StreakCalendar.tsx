const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * A 5-week grid (35 days, oldest at top-left, columns aligned Sun-Sat so it
 * reads like a real calendar) with a filled cell for every day
 * `activeDays` (from `useActivityDays`) says had activity. Today gets its own
 * outline whether or not it is filled yet, so the child can see where today's
 * cell is even before earning anything today. Encouraging, not a report card:
 * no streak-broken language, just a pattern of good days.
 */
export function StreakCalendar({ activeDays, days = 35 }: { activeDays: Set<string>; days?: number }) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const todayIso = isoDate(today)
  const leadingPad = start.getUTCDay()

  const cells: { iso: string; active: boolean; isToday: boolean }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const iso = isoDate(d)
    cells.push({ iso, active: activeDays.has(iso), isToday: iso === todayIso })
  }

  return (
    <div className="kp-cal" data-testid="streak-calendar">
      <div className="kp-cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="kp-cal-grid" role="img" aria-label={`${activeDays.size} active days in the last ${days} days`}>
        {Array.from({ length: leadingPad }, (_, i) => (
          <span key={`pad-${i}`} className="kp-cal-cell" data-pad="true" aria-hidden="true" />
        ))}
        {cells.map((c) => (
          <span
            key={c.iso}
            className="kp-cal-cell"
            data-active={c.active ? 'true' : undefined}
            data-today={c.isToday ? 'true' : undefined}
            title={c.iso}
          />
        ))}
      </div>
    </div>
  )
}
