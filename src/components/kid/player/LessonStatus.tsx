import { Check, Sparkles } from 'lucide-react'
import { clockText } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * The lesson title with its status marker on the same line, shared by the video
 * and doc lesson pages. The marker is either the XP pill (still to earn) or a
 * small check badge (finished), never both, and it is glued to the title's last
 * word so a title that fills the line wraps that word and the marker together.
 * A status, not a control; plain inline content that nothing overlaps.
 */
export function LessonTitle({
  title,
  xp,
  done,
  prefix,
}: {
  title: string
  /** XP still to earn, or null for none (replay, gamification off, unknown). */
  xp: number | null
  done: boolean
  /** Test id prefix: `<prefix>-title-row` and `<prefix>-xp`. */
  prefix: string
}) {
  const words = title.trim().split(/\s+/)
  const last = words.pop() ?? ''
  const lead = words.length ? `${words.join(' ')} ` : ''
  return (
    <h1 className="lp-hero-title" data-testid={`${prefix}-title-row`}>
      {lead}
      <span className="lp-vtitle-tail">
        {last}
        {done ? (
          <span className="lp-done-mark" role="img" aria-label={playerCopy.page.done} data-testid="done-badge">
            <Check className="size-4" strokeWidth={3.5} aria-hidden />
          </span>
        ) : xp !== null && xp > 0 ? (
          <span className="rm-chip" data-testid={`${prefix}-xp`}>
            <Sparkles className="size-3.5" aria-hidden />+{xp} XP
          </span>
        ) : null}
      </span>
    </h1>
  )
}

/**
 * What sits above a block-based doc lesson's content: the title with its status
 * marker and the slim minimum-time bar. Nothing else (no hero, no description).
 */
export function DocInfo({
  title,
  xp,
  done,
  seconds,
  minSeconds,
  timeMet,
}: {
  title: string
  xp: number | null
  done: boolean
  seconds: number
  minSeconds: number
  timeMet: boolean
}) {
  return (
    <section className="lp-vinfo" data-testid="doc-info">
      <LessonTitle title={title} xp={xp} done={done} prefix="doc" />
      <LessonTimeBar seconds={seconds} minSeconds={minSeconds} timeMet={timeMet} done={done} label={playerCopy.doc.readTime} />
    </section>
  )
}

/**
 * The slim minimum-time bar: a `--teal-d` fill on the muted track with a line
 * such as "Watch time 0:05 of 2:00" under it. Hidden once the lesson is done or
 * when there is no minimum. It only shows what the server last confirmed.
 */
export function LessonTimeBar({
  seconds,
  minSeconds,
  timeMet,
  done,
  label,
}: {
  seconds: number
  minSeconds: number
  timeMet: boolean
  done: boolean
  /** The line under the bar, given the elapsed and minimum clocks. */
  label: (elapsed: string, min: string) => string
}) {
  if (done || minSeconds <= 0) return null
  const shown = timeMet ? minSeconds : Math.min(seconds, minSeconds)
  const percent = Math.round((shown / minSeconds) * 100)
  const text = label(clockText(shown), clockText(minSeconds))
  return (
    <div className="lp-timebar" data-testid="time-bar">
      <div
        className="lp-timebar-track"
        role="progressbar"
        aria-label={playerCopy.ring.label}
        aria-valuemin={0}
        aria-valuemax={minSeconds}
        aria-valuenow={shown}
        aria-valuetext={text}
      >
        <span className="lp-timebar-fill" style={{ width: `${percent}%` }} data-testid="time-bar-fill" />
      </div>
      <p className="lp-timebar-text kid-num">{text}</p>
    </div>
  )
}
