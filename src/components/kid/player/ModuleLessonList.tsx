import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import type { ModulePath } from '@/hooks/useModulePath'
import type { RoadmapLesson } from '@/lib/roadmap'
import { playerCopy } from '@/lib/playerCopy'

type RowKind = 'done' | 'current' | 'next' | 'locked' | 'open'

function kindOf(lesson: RoadmapLesson, currentId: string, nextUpId: string | null): RowKind {
  if (lesson.id === currentId) return 'current'
  if (lesson.state === 'completed') return 'done'
  if (lesson.state === 'locked') return 'locked'
  if (lesson.id === nextUpId) return 'next'
  return 'open'
}

function RowIcon({ kind, lesson }: { kind: RowKind; lesson: RoadmapLesson }) {
  if (kind === 'done') return <Check className="size-5" strokeWidth={3.5} />
  if (kind === 'locked') return <Lock className="size-5" strokeWidth={2.5} />
  if (kind === 'next') return <ArrowRight className="size-5" strokeWidth={3} />
  const { Icon } = LESSON_TYPE_META[lesson.type]
  return <Icon className="size-5" strokeWidth={2.5} />
}

/**
 * The module's lessons, one row each: the ONLY list on the page and the only
 * count ("3 of 5", this module's published lessons). Below lg it sits under
 * the activity card; from lg the same component is a sticky left column. Every
 * state has its own icon (check, lock, arrow, the lesson type) and a spoken
 * word, never colour alone. Locked rows are dimmed and not tappable, with no
 * explanation text. Which lesson is locked or next comes from the engine.
 */
export function ModuleLessonList({
  path,
  courseId,
  currentLessonId,
}: {
  path: ModulePath
  courseId: string
  currentLessonId: string
}) {
  return (
    <nav className="lp-list kid-card" aria-label={path.moduleTitle ?? playerCopy.page.lessonsInModule} data-testid="module-list">
      <div className="lp-list-head">
        <h2 className="lp-list-title">{path.moduleTitle ?? ' '}</h2>
        <span className="lp-list-count kid-num" data-testid="module-count">
          <span className="lp-ring" style={{ '--p': path.percent } as CSSProperties} aria-hidden="true" />
          {playerCopy.page.countOf(path.done, path.total)}
        </span>
      </div>
      {path.lessons ? (
        <ol className="lp-rows">
          {path.lessons.map((lesson) => {
            const kind = kindOf(lesson, currentLessonId, path.nextUpId)
            const body = (
              <>
                <span className="lp-row-icon" aria-hidden="true">
                  <RowIcon kind={kind} lesson={lesson} />
                </span>
                <span className="lp-row-title">{lesson.title}</span>
                {kind === 'next' ? (
                  <span className="lp-row-tag" aria-hidden="true">
                    {playerCopy.page.nextTag}
                  </span>
                ) : null}
                <span className="sr-only">{`, ${playerCopy.page.rowState[kind]}`}</span>
              </>
            )
            return (
              <li key={lesson.id}>
                {kind === 'locked' ? (
                  <span className="lp-row" data-kind="locked" aria-disabled="true">
                    {body}
                  </span>
                ) : (
                  <Link
                    to="/courses/$courseId/lessons/$lessonId"
                    params={{ courseId, lessonId: lesson.id }}
                    replace
                    className="lp-row kid-tap"
                    data-kind={kind}
                    aria-current={kind === 'current' ? 'page' : undefined}
                  >
                    {body}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="lp-rows" aria-busy="true">
          {Array.from({ length: Math.max(path.total, 1) }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl bg-ink/10" />
          ))}
        </div>
      )}
    </nav>
  )
}
