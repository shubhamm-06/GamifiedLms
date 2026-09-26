import { playerCopy } from '@/lib/playerCopy'
import { LessonTimeBar, LessonTitle } from './LessonStatus'

/**
 * What sits under a video lesson's player, top to bottom: the title with its
 * status marker on the same line, the description as a normal paragraph and,
 * while the lesson can still be completed, the slim minimum-time bar (which
 * counts time the video was actually playing and is not the scrubber). Replaying
 * lives in the player's own controls. See `LessonStatus` for the shared parts.
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
  xp: number | null
  done: boolean
  seconds: number
  minSeconds: number
  timeMet: boolean
}) {
  return (
    <section className="lp-vinfo" data-testid="video-info">
      <LessonTitle title={title} xp={xp} done={done} prefix="video" />
      {description ? (
        <p className="lp-vdesc" data-testid="video-description">
          {description}
        </p>
      ) : null}
      <LessonTimeBar
        seconds={seconds}
        minSeconds={minSeconds}
        timeMet={timeMet}
        done={done}
        label={playerCopy.video.watchTime}
      />
    </section>
  )
}
