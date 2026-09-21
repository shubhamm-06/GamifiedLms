import { Check, Pause } from 'lucide-react'
import type { ClockPause } from '@/hooks/useLessonClock'
import { clockText, secondsLeft, spokenDuration } from '@/lib/lessonPlayer'

const RADIUS = 19
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Active time toward the lesson's minimum, as a ring with the time left inside.
 * It shows what the server has confirmed (plus a little smoothing between
 * beats); it never decides anything. It is a progressbar for assistive tech with
 * a spoken value, and the state is never colour alone: a check when the time is
 * done, a pause mark when the clock is not running, the time left otherwise.
 * Renders nothing for a lesson with no minimum time.
 */
export function ActiveTimeRing({
  seconds,
  minSeconds,
  timeMet,
  pause,
}: {
  seconds: number
  minSeconds: number
  timeMet: boolean
  pause: ClockPause | null
}) {
  if (minSeconds <= 0) return null
  const shown = timeMet ? minSeconds : Math.min(seconds, minSeconds)
  const fraction = Math.min(1, shown / minSeconds)
  const left = secondsLeft(minSeconds, shown)
  const label = timeMet
    ? 'Time is up. You can finish the lesson.'
    : `${spokenDuration(left)} left${pause ? ', paused' : ''}`

  return (
    <div
      className="lp-ring"
      role="progressbar"
      aria-label="Time on this lesson"
      aria-valuemin={0}
      aria-valuemax={minSeconds}
      aria-valuenow={shown}
      aria-valuetext={label}
      data-testid="time-ring"
      data-paused={pause ?? undefined}
      data-done={timeMet ? 'true' : undefined}
    >
      <svg viewBox="0 0 44 44" className="lp-ring-svg" aria-hidden="true" focusable="false">
        <circle className="lp-ring-track" cx="22" cy="22" r={RADIUS} />
        <circle
          className="lp-ring-fill"
          cx="22"
          cy="22"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="lp-ring-center" aria-hidden="true">
        {timeMet ? (
          <Check className="size-5" strokeWidth={3.5} />
        ) : pause ? (
          <Pause className="size-4" strokeWidth={3} />
        ) : (
          <span data-testid="time-left">{clockText(left)}</span>
        )}
      </span>
    </div>
  )
}
