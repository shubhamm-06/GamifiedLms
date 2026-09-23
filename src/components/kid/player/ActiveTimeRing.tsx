import { Check, Clock, Pause } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ClockPause } from '@/hooks/useLessonClock'
import { clockText, spokenDuration } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

const RADIUS = 17
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Active time toward the lesson's minimum (spec Part B2): a 40px ring with a
 * clock icon inside, no numbers. The fill is `--teal-d` the whole time (see
 * `ui.md` for why: `--gold`/`--gold-d` both fail 3:1 against `--cream`, so the
 * spec's literal gold-then-teal colour change is not accessible here), and the
 * "time met" moment is carried by the icon swapping to a check with one
 * overshoot pop instead. Paused (hidden tab, offline, reconnecting) dims the
 * whole ring to 60% and resumes silently — no banner, no modal. Tapping it
 * opens a small popover with the only exact numbers in this UI. It never
 * decides anything; it only shows what the server last confirmed, plus a
 * little local smoothing between beats.
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
  const label = timeMet ? playerCopy.ring.doneLabel : `${spokenDuration(minSeconds - shown)} left${pause ? ', paused' : ''}`
  const popoverText = playerCopy.ring.popover(clockText(shown), clockText(minSeconds))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="lp-ring-tap kid-tap"
          aria-label={playerCopy.ring.label}
          data-testid="time-ring"
        >
          <span
            className="lp-ring"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={minSeconds}
            aria-valuenow={shown}
            aria-valuetext={label}
            data-paused={pause ?? undefined}
            data-done={timeMet ? 'true' : undefined}
          >
            <svg viewBox="0 0 40 40" className="lp-ring-svg" aria-hidden="true" focusable="false">
              <circle className="lp-ring-track" cx="20" cy="20" r={RADIUS} />
              <circle
                className="lp-ring-fill"
                cx="20"
                cy="20"
                r={RADIUS}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              />
            </svg>
            <span className="lp-ring-center lp-ring-icon" aria-hidden="true">
              {timeMet ? (
                <Check className="size-4 text-teal-d" strokeWidth={3.5} />
              ) : pause ? (
                <Pause className="size-3.5" strokeWidth={3} />
              ) : (
                <Clock className="size-4" strokeWidth={2.5} />
              )}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="kid-font w-auto rounded-2xl border-0 bg-surface px-3 py-2 text-ink shadow-[var(--kid-shadow)] ring-0"
        data-testid="time-popover"
      >
        <p className="lp-ring-pop-text kid-num">{popoverText}</p>
      </PopoverContent>
    </Popover>
  )
}
