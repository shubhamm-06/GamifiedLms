import type { CSSProperties } from 'react'
import { Check, Clock, Lock, Sparkles, Star } from 'lucide-react'
import { formatClock } from '@/lib/lessonSettings'
import type { RoadmapLesson } from '@/lib/roadmap'
import { LESSON_TYPE_META, STATE_WORD } from './lessonTypeMeta'

/** Gentle left / centre / right / centre zigzag, repeating. */
const OFFSETS = [0, -1, 0, 1] as const

interface Props {
  lesson: RoadmapLesson
  /** Position within its section, for the zigzag. */
  index: number
  isCurrent: boolean
  onOpen: (lessonId: string) => void
}

/**
 * One lesson on the path: a large candy circle plus its label and chips. The
 * state is shown by shape as well as colour — a check + star (completed), a
 * lock (locked), a progress ring (in progress), a pulsing ring (available).
 */
export function LessonNode({ lesson, index, isCurrent, onOpen }: Props) {
  const off = OFFSETS[index % OFFSETS.length]
  const { label: typeLabel, Icon: TypeIcon } = LESSON_TYPE_META[lesson.type]
  const ariaLabel = `Lesson ${lesson.number}, ${lesson.title}, ${typeLabel.toLowerCase()}, ${STATE_WORD[lesson.state]}`
  const showXp = lesson.xp !== null && lesson.xp > 0
  const showTime = lesson.minTimeSeconds > 0

  return (
    <div className="rm-row" data-off={off} style={{ '--off': off } as CSSProperties} data-testid="lesson-row">
      <div className="rm-slot">
        <button
          type="button"
          className="rm-node kid-tap"
          data-state={lesson.state}
          data-lesson-id={lesson.id}
          data-current={isCurrent ? 'true' : undefined}
          aria-label={ariaLabel}
          onClick={() => onOpen(lesson.id)}
        >
          {lesson.state === 'in_progress' ? (
            <span
              className="rm-ring"
              data-testid="progress-ring"
              data-progress={lesson.progress === null ? 'plain' : Math.round(lesson.progress * 100)}
              style={
                lesson.progress === null
                  ? undefined
                  : ({ '--p': Math.round(lesson.progress * 100) } as CSSProperties)
              }
              aria-hidden
            />
          ) : null}
          {lesson.state === 'locked' ? (
            <Lock className="size-7" strokeWidth={2.5} aria-hidden />
          ) : lesson.state === 'completed' ? (
            <Check className="size-8" strokeWidth={4} aria-hidden />
          ) : (
            <TypeIcon className="size-7" strokeWidth={2.5} aria-hidden />
          )}
          {lesson.state === 'completed' ? (
            <span className="rm-badge rm-badge-star" aria-hidden>
              <Star className="size-3.5" fill="currentColor" strokeWidth={2} />
            </span>
          ) : null}
          {lesson.state === 'locked' || lesson.state === 'completed' ? (
            <span className="rm-badge rm-badge-type" aria-hidden>
              <TypeIcon className="size-3.5" strokeWidth={2.5} />
            </span>
          ) : null}
        </button>
        <span className="rm-label">{lesson.title}</span>
        {showXp || showTime ? (
          <div className="rm-chips">
            {showXp ? (
              <span className="rm-chip">
                <Sparkles className="size-3.5" aria-hidden />+{lesson.xp} XP
              </span>
            ) : null}
            {showTime ? (
              <span className="rm-chip">
                <Clock className="size-3.5" aria-hidden />
                {formatClock(lesson.minTimeSeconds)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
