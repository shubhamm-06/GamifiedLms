import type { ReactNode } from 'react'

/**
 * The bottom action bar of the lesson player: sticky, with the safe-area inset in
 * its own padding, holding the ONE primary (candy) action for the current step.
 * Same behaviour as the roadmap's Continue bar. An optional hint sits above the
 * button (for example the time still to go).
 */
export function PlayerBar({ hint, children }: { hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="lp-bar" data-testid="player-bar">
      {hint ? (
        <p className="lp-bar-hint" data-testid="player-hint">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  )
}
