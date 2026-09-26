import { Check, RotateCcw, Sparkles } from 'lucide-react'
import { clockText } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * What sits under a video lesson's player, top to bottom: the title, one slim
 * status row (the XP pill, the Done badge once finished, and a small Play again
 * for a finished lesson), the description as a normal paragraph and, while the
 * lesson can still be completed, a slim bar for the minimum active time. Plain
 * inline content: nothing floats or is positioned, so nothing can sit under the
 * top bar. The bar counts time the video was actually playing and is not the
 * scrubber. A finished lesson shows no XP pill and no bar: replaying earns nothing.
 */
export function VideoInfo({
  title,
  description,
  xp,
  done,
  onReplay,
  seconds,
  minSeconds,
  timeMet,
}: {
  title: string
  description: string | null
  /** XP still to earn, or null for none (replay, gamification off, unknown). */
  xp: number | null
  done: boolean
  onReplay: () => void
  seconds: number
  minSeconds: number
  timeMet: boolean
}) {
  const shown = timeMet ? minSeconds : Math.min(seconds, minSeconds)
  const percent = minSeconds > 0 ? Math.round((shown / minSeconds) * 100) : 100
  const showXp = xp !== null && xp > 0
  return (
    <section className="lp-vinfo" data-testid="video-info">
      <h1 className="lp-hero-title">{title}</h1>
      {showXp || done ? (
        <div className="lp-vinfo-status" data-testid="video-status">
          {showXp ? (
            <span className="rm-chip" data-testid="video-xp">
              <Sparkles className="size-3.5" aria-hidden />+{xp} XP
            </span>
          ) : null}
          {done ? (
            <>
              <span className="lp-done" data-testid="done-badge">
                <Check className="size-5" strokeWidth={3.5} aria-hidden />
                {playerCopy.page.done}
              </span>
              <button type="button" className="lp-replay kid-tap" onClick={onReplay} data-testid="replay-button">
                <RotateCcw className="size-4" strokeWidth={2.75} aria-hidden />
                {playerCopy.page.playAgain}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
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
