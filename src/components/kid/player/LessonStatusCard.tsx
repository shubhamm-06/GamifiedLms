import type { ReactNode } from 'react'

/**
 * The lesson shell's one-line status card (ui.md "Lesson pages redesign"): never a
 * timer, just what happens next in one sentence. `done` swaps the icon's and card's
 * tint from neutral to teal — the only two states; an in-flight error (a failed
 * manual completion) is shown by the caller as a plain line instead of this card.
 */
export function LessonStatusCard({ done, icon, heading, sub }: { done: boolean; icon: ReactNode; heading: string; sub?: ReactNode }) {
  return (
    <div className="lp-status" data-done={done ? 'true' : undefined} data-testid="status-card">
      <span className="lp-status-icon" aria-hidden>
        {icon}
      </span>
      <div className="lp-status-text">
        <p className="lp-status-heading">{heading}</p>
        {sub ? <p className="lp-status-sub">{sub}</p> : null}
      </div>
    </div>
  )
}
