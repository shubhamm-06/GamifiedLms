import { Link } from '@tanstack/react-router'
import { Check, Lock } from 'lucide-react'
import type { RoadmapLesson } from '@/lib/roadmap'
import { playerCopy } from '@/lib/playerCopy'

/**
 * The episode list shared by the bottom sheet (below lg) and the sidebar
 * (lg and up), so the two can never disagree. Active = the lesson open now;
 * locked = the engine says so (never re-derived here). State is never colour
 * alone: a check, a lock or the number, plus a spoken state word.
 */
export function CoursePathList({
  items,
  currentLessonId,
  courseId,
  onNavigate,
}: {
  items: RoadmapLesson[] | null
  currentLessonId: string
  courseId: string
  onNavigate?: () => void
}) {
  if (!items) {
    return (
      <p className="lp-path-hint" role="status">
        Loading your episodes.
      </p>
    )
  }
  return (
    <ol className="lp-path-list" data-testid="course-path-list">
      {items.map((lesson) => {
        const active = lesson.id === currentLessonId
        const locked = lesson.state === 'locked'
        const body = (
          <>
            <span className="lp-path-num" aria-hidden="true">
              {lesson.state === 'completed' ? (
                <Check className="size-4" strokeWidth={3.5} />
              ) : locked ? (
                <Lock className="size-4" strokeWidth={2.5} />
              ) : (
                lesson.number
              )}
            </span>
            <span className="lp-path-title">{lesson.title}</span>
            <span className="sr-only">
              {`, episode ${lesson.number}, ${playerCopy.page.stateWord[lesson.state]}${active ? ', open now' : ''}`}
            </span>
          </>
        )
        return (
          <li key={lesson.id}>
            {locked ? (
              <span className="lp-path-row" data-state="locked" aria-disabled="true">
                {body}
              </span>
            ) : (
              <Link
                to="/courses/$courseId/lessons/$lessonId"
                params={{ courseId, lessonId: lesson.id }}
                className="lp-path-row kid-tap"
                data-state={lesson.state}
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ol>
  )
}
