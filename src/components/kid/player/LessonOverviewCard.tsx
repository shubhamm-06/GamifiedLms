import { Check, Sparkles } from 'lucide-react'
import type { CoursePath } from '@/hooks/useCoursePath'
import type { LessonContent } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import type { PlayerMode } from './LessonPlayerShell'

/**
 * Breadcrumb, a heading, the lesson's own description (`lessons.summary`) and
 * meta pills: episode X of N, what kind of lesson it is, the XP still to earn
 * (only while it can be earned: never in replay, never when the course awards
 * none) and the minimum time, rounded up to whole minutes. Pills are plum or
 * teal tints, never gold.
 */
export function LessonOverviewCard({
  lesson,
  path,
  mode,
  minTimeSeconds,
}: {
  lesson: LessonContent
  path: CoursePath
  mode: PlayerMode
  minTimeSeconds: number
}) {
  const earnable = mode === 'play' && lesson.gamificationEnabled && lesson.xp !== null && lesson.xp > 0
  const minutes = minTimeSeconds > 0 ? Math.max(1, Math.ceil(minTimeSeconds / 60)) : 0
  return (
    <section className="lp-overview kid-card" aria-labelledby="lesson-overview-title" data-testid="lesson-overview">
      <div className="lp-overview-copy">
        <p className="lp-breadcrumb">
          <span className="truncate">{path.courseTitle ?? playerCopy.page.coursePath}</span>
          <span aria-hidden="true">›</span>
          <span className="kid-num flex-none">Episode {path.number}</span>
        </p>
        <h2 id="lesson-overview-title" className="lp-overview-title">
          {playerCopy.page.aboutEpisode}
        </h2>
        {lesson.summary ? <p className="lp-overview-text">{lesson.summary}</p> : null}
      </div>
      <div className="lp-pills">
        <span className="lp-pill" data-tone="plum">
          {playerCopy.page.episodeOf(path.number, path.total)}
        </span>
        <span className="lp-pill" data-tone="teal">
          {playerCopy.page.typeWord[lesson.type]}
        </span>
        {earnable ? (
          <span className="lp-pill kid-num" data-tone="plum" data-testid="xp-chip">
            <Sparkles className="size-4 text-coral-d" aria-hidden />+{lesson.xp} XP
          </span>
        ) : null}
        {minutes > 0 && mode === 'play' ? (
          <span className="lp-pill kid-num" data-tone="neutral">
            {playerCopy.page.aboutTime(minutes)}
          </span>
        ) : null}
        {mode === 'replay' ? (
          <span className="lp-pill" data-tone="teal" data-testid="completed-chip">
            <Check className="size-4" strokeWidth={3} aria-hidden />
            {playerCopy.replay.chip}
          </span>
        ) : null}
      </div>
    </section>
  )
}
