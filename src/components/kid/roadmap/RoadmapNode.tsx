import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, Clock, Lock, Sparkles, Star } from 'lucide-react'
import { formatClock } from '@/lib/lessonSettings'
import type { RoadmapLesson } from '@/lib/roadmap'
import { LESSON_TYPE_META, STATE_WORD } from './lessonTypeMeta'

/** Gentle left / centre / right / centre weave, repeating. */
const OFFSETS = [0, -1, 0, 1] as const

interface Props {
  lesson: RoadmapLesson
  /** Position within its section, for the weave. */
  index: number
  isCurrent: boolean
  onOpen: (lessonId: string) => void
}

/**
 * One lesson on the path. Hierarchy: the active node is the biggest, boldest
 * thing (idle bounce); completed nodes are medium with a check and star; locked
 * nodes are small and soft. The state is never colour alone (check + star,
 * lock, progress ring, pulsing ring), and the type badge is big and dark so a
 * child can see what is coming. XP / time chips show only on active and
 * completed nodes; a locked node shows its title only.
 */
export function RoadmapNode({ lesson, index, isCurrent, onOpen }: Props) {
  const off = OFFSETS[index % OFFSETS.length]
  const { label: typeLabel, Icon: TypeIcon } = LESSON_TYPE_META[lesson.type]
  const locked = lesson.state === 'locked'
  const active = lesson.state === 'available' || lesson.state === 'in_progress'
  const ariaLabel = `Lesson ${lesson.number}, ${lesson.title}, ${typeLabel.toLowerCase()}, ${STATE_WORD[lesson.state]}`
  const showXp = !locked && lesson.xp !== null && lesson.xp > 0
  const showTime = !locked && lesson.minTimeSeconds > 0

  // Tapping a locked node wiggles it (skipped under prefers-reduced-motion in CSS).
  const [wiggle, setWiggle] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  function handleClick() {
    if (locked) {
      window.clearTimeout(timer.current)
      setWiggle(true)
      timer.current = window.setTimeout(() => setWiggle(false), 600)
    }
    onOpen(lesson.id)
  }

  return (
    <div className="rm-row" data-off={off} style={{ '--off': off } as CSSProperties} data-testid="lesson-row">
      <div className="rm-slot">
        <div
          className="rm-node-box"
          data-rm-anchor
          data-active={active ? 'true' : undefined}
          data-wiggle={wiggle ? 'true' : undefined}
        >
          <div className="rm-node-motion">
            <button
              type="button"
              className="rm-node kid-tap"
              data-state={lesson.state}
              data-lesson-id={lesson.id}
              data-current={isCurrent ? 'true' : undefined}
              aria-label={ariaLabel}
              onClick={handleClick}
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
              {locked ? (
                <Lock className="size-[22px]" strokeWidth={2.5} aria-hidden />
              ) : lesson.state === 'completed' ? (
                <Check className="size-8" strokeWidth={4} aria-hidden />
              ) : (
                <TypeIcon className="size-8" strokeWidth={2.5} aria-hidden />
              )}
              {lesson.state === 'completed' ? (
                <span className="rm-badge rm-badge-star" aria-hidden>
                  <Star className="size-3.5" fill="currentColor" strokeWidth={2} />
                </span>
              ) : null}
              {locked || lesson.state === 'completed' ? (
                <span className="rm-badge rm-badge-type" aria-hidden>
                  <TypeIcon className="size-4" strokeWidth={2.75} />
                </span>
              ) : null}
            </button>
          </div>
        </div>
        <span className="rm-label" data-locked={locked ? 'true' : undefined}>
          {lesson.title}
        </span>
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
