import { Check, Sparkles } from 'lucide-react'
import { clockText } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * What sits under a video lesson's player: the title, the module it belongs to,
 * the lesson's XP as the same pill the roadmap nodes use, and (while the lesson
 * can still be completed) a slim bar for the minimum active time. The bar counts
 * time the video was actually playing and is deliberately not the video's own
 * scrubber. A finished lesson shows the Done badge and no XP pill: replaying it
 * earns nothing.
 */
export function VideoInfo({
  title,
  moduleTitle,
  xp,
  done,
  seconds,
  minSeconds,
  timeMet,
}: {
  title: string
  moduleTitle: string | null
  /** XP still to earn, or null for none (replay, gamification off, unknown). */
  xp: number | null
  done: boolean
  seconds: number
  minSeconds: number
  timeMet: boolean
}) {
  const shown = timeMet ? minSeconds : Math.min(seconds, minSeconds)
  const percent = minSeconds > 0 ? Math.round((shown / minSeconds) * 100) : 100
  return (
    <section className="lp-vinfo" data-testid="video-info">
      <h1 className="lp-hero-title">{title}</h1>
      <p className="lp-hero-sub">{moduleTitle ?? ' '}</p>
      <div className="lp-vinfo-chips">
        {xp !== null && xp > 0 ? (
          <span className="rm-chip" data-testid="video-xp">
            <Sparkles className="size-3.5" aria-hidden />+{xp} XP
          </span>
        ) : null}
        {done ? (
          <span className="lp-done" data-testid="done-badge">
            <Check className="size-5" strokeWidth={3.5} aria-hidden />
            {playerCopy.page.done}
          </span>
        ) : null}
      </div>
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
