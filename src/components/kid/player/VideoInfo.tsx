import { Check, Sparkles } from 'lucide-react'
import { clockText } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * What sits under a video lesson's player, top to bottom: the title with its
 * status marker on the same line, the description as a normal paragraph and,
 * while the lesson can still be completed, a slim bar for the minimum active
 * time. The marker is either the XP pill (still to earn) or a small check badge
 * (finished): a status, not a control, and never both. Plain inline content:
 * nothing floats, so nothing can sit under the top bar. The bar counts time the
 * video was actually playing and is not the scrubber. Replaying lives in the
 * player's own controls.
 */
export function VideoInfo({
  title,
  description,
  xp,
  done,
  seconds,
  minSeconds,
  timeMet,
}: {
  title: string
  description: string | null
  /** XP still to earn, or null for none (replay, gamification off, unknown). */
  xp: number | null
  done: boolean
  seconds: number
  minSeconds: number
  timeMet: boolean
}) {
  const shown = timeMet ? minSeconds : Math.min(seconds, minSeconds)
  const percent = minSeconds > 0 ? Math.round((shown / minSeconds) * 100) : 100
  // The marker is glued to the title's last word, so a title that fills the line wraps that word
  // and the marker together instead of leaving the marker alone on the next line.
  const words = title.trim().split(/\s+/)
  const last = words.pop() ?? ''
  const lead = words.length ? `${words.join(' ')} ` : ''
  return (
    <section className="lp-vinfo" data-testid="video-info">
      <h1 className="lp-hero-title" data-testid="video-title-row">
        {lead}
        <span className="lp-vtitle-tail">
          {last}
          {done ? (
            <span className="lp-done-mark" role="img" aria-label={playerCopy.page.done} data-testid="done-badge">
              <Check className="size-4" strokeWidth={3.5} aria-hidden />
            </span>
          ) : xp !== null && xp > 0 ? (
            <span className="rm-chip" data-testid="video-xp">
              <Sparkles className="size-3.5" aria-hidden />+{xp} XP
            </span>
          ) : null}
        </span>
      </h1>
      {description ? (
        <p className="lp-vdesc" data-testid="video-description">
          {description}
        </p>
      ) : null}
      {!done && minSeconds > 0 ? (
        <div className="lp-timebar" data-testid="time-bar">
          <div
            className="lp-timebar-track"
            role="progressbar"
            aria-label={playerCopy.ring.label}
            aria-valuemin={0}
            aria-valuemax={minSeconds}
            aria-valuenow={shown}
            aria-valuetext={playerCopy.video.watchTime(clockText(shown), clockText(minSeconds))}
          >
            <span className="lp-timebar-fill" style={{ width: `${percent}%` }} data-testid="time-bar-fill" />
          </div>
          <p className="lp-timebar-text kid-num">{playerCopy.video.watchTime(clockText(shown), clockText(minSeconds))}</p>
        </div>
      ) : null}
    </section>
  )
}
