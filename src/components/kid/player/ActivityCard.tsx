import type { ReactNode } from 'react'
import { Check, Play } from 'lucide-react'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import type { LessonContent } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'

/**
 * The one card holding the lesson's activity. For a video or game: a short
 * description line and the big Play button (THE main action, gold) until the
 * child taps it, then the video or game itself. Reading lessons show their
 * text straight away; quizzes run their own flow without the card chrome
 * (their sticky bar cannot live inside a card). A completed lesson gets one
 * teal "Done" badge, and its Play button is no longer gold, because the
 * "Next" button below is then the main action.
 */
export function ActivityCard({
  lesson,
  done,
  needsPlay,
  onPlay,
  children,
}: {
  lesson: LessonContent
  done: boolean
  /** True while a video/game is waiting for its Play tap. */
  needsPlay: boolean
  onPlay: () => void
  children: ReactNode
}) {
  const description = lesson.summary?.trim() || playerCopy.page.describe[lesson.type]
  const badge = done ? (
    <span className="lp-done" data-testid="done-badge">
      <Check className="size-5" strokeWidth={3.5} aria-hidden />
      {playerCopy.page.done}
    </span>
  ) : null

  if (lesson.type === 'quiz') {
    return (
      <div className="lp-activity-bare" data-testid="activity-card">
        {badge}
        {children}
      </div>
    )
  }

  const { Icon } = LESSON_TYPE_META[lesson.type]
  return (
    <section className="lp-activity kid-card" aria-label={lesson.title} data-testid="activity-card" data-done={done ? 'true' : undefined}>
      {badge}
      {needsPlay ? (
        <span className="lp-activity-art" aria-hidden="true">
          <Icon className="size-12" strokeWidth={2.25} />
        </span>
      ) : (
        children
      )}
      {needsPlay || lesson.type === 'text' ? <p className="lp-activity-text">{description}</p> : null}
      {needsPlay ? (
        <button
          type="button"
          className="lp-primary kid-tap"
          data-variant={done ? 'secondary' : 'candy'}
          onClick={onPlay}
          data-testid="play-button"
        >
          <Play className="size-6" fill="currentColor" strokeWidth={0} aria-hidden />
          {done ? playerCopy.page.playAgain : playerCopy.page.play}
        </button>
      ) : null}
    </section>
  )
}
