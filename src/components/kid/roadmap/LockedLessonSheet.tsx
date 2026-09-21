import type { ComponentType, ReactNode } from 'react'
import { Clock, Footprints, LockKeyhole, Sparkles } from 'lucide-react'
import { formatClock } from '@/lib/lessonSettings'
import { unlockPlan, type Roadmap, type RoadmapLesson } from '@/lib/roadmap'
import { LESSON_TYPE_META } from './lessonTypeMeta'

type TextSlot = ComponentType<{ className?: string; children?: ReactNode }>

/** The friendly line. Names the lesson to do next; short and kid-readable. */
function lockedCopy(lesson: RoadmapLesson, next: RoadmapLesson | null, steps: number): string {
  if (!next) return `${lesson.title} opens once the lessons before it are done.`
  if (steps === 1) return `Almost there! Finish “${next.title}” to unlock ${lesson.title}.`
  return `Keep going! Finish “${next.title}” next to get closer to ${lesson.title}.`
}

/**
 * The body of the sheet for a locked lesson: a lock illustration, the lesson's
 * type / XP / minimum-time chips, an encouraging line naming the lesson to do
 * next, and a "N steps to go" hint counted from the real ordered states. No
 * action button: there is nothing to start yet.
 */
export function LockedLessonSheet({
  roadmap,
  lesson,
  Title,
  Description,
}: {
  roadmap: Roadmap
  lesson: RoadmapLesson
  Title: TextSlot
  Description: TextSlot
}) {
  const { label, Icon } = LESSON_TYPE_META[lesson.type]
  const showXp = lesson.xp !== null && lesson.xp > 0
  const { next, steps } = unlockPlan(roadmap, lesson.id)
  return (
    <div
      className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      data-testid="lesson-sheet"
      data-state="locked"
    >
      <div className="rm-sheet-lock" aria-hidden data-testid="sheet-lock-icon">
        <LockKeyhole className="size-9" strokeWidth={2.25} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-base font-bold">
        <span className="rm-chip">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
        {showXp ? (
          <span className="rm-chip">
            <Sparkles className="size-3.5" aria-hidden />+{lesson.xp} XP
          </span>
        ) : null}
        {lesson.minTimeSeconds > 0 ? (
          <span className="rm-chip">
            <Clock className="size-3.5" aria-hidden />
            At least {formatClock(lesson.minTimeSeconds)}
          </span>
        ) : null}
      </div>
      <Title className="mt-3 text-2xl leading-tight font-extrabold text-ink [font-family:var(--font-kid)]! [overflow-wrap:anywhere]">
        {lesson.title}
      </Title>
      <Description className="mt-2 text-lg leading-snug font-medium text-ink">
        <span data-testid="sheet-status">{lockedCopy(lesson, next, steps)}</span>
      </Description>
      {steps > 0 ? (
        <p className="rm-sheet-hint" data-testid="sheet-steps">
          <Footprints className="size-4" aria-hidden />
          {steps} {steps === 1 ? 'step' : 'steps'} to go
        </p>
      ) : null}
    </div>
  )
}
