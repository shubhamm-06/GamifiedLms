import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Clock, RotateCcw, Sparkles } from 'lucide-react'
import { useKidHeader, useKidRightSlot } from '@/components/kid/kidHeader'
import { LESSON_TYPE_META } from '@/components/kid/roadmap/lessonTypeMeta'
import type { ClockPause } from '@/hooks/useLessonClock'
import { clockText, type LessonContent } from '@/lib/lessonPlayer'
import { ActiveTimeRing } from './ActiveTimeRing'
import { PausedNotice } from './PausedNotice'

export type PlayerMode = 'play' | 'replay' | 'done'

interface Props {
  lesson: LessonContent
  courseId: string
  mode: PlayerMode
  clock: { displaySeconds: number; minTimeSeconds: number; timeMet: boolean; pause: ClockPause | null }
  /** The lesson's content (video, document, game or quiz). */
  children: ReactNode
  /** The bottom bar, when the page (not the quiz) owns the primary action. */
  bar?: ReactNode
}

/**
 * The frame every lesson type plays in. It puts the lesson title in the top bar
 * and the active-time ring at its right end, shows why the timer is paused, the
 * lesson's type / XP / minimum-time chips (XP only while it can still be earned:
 * never in replay, never when the course awards none), and a replay note for a
 * lesson already completed. It holds no rules: the clock, the XP and the
 * completion all come from the server.
 */
export function LessonPlayerShell({ lesson, courseId, mode, clock, children, bar }: Props) {
  useKidHeader(lesson.title, `/courses/${courseId}`)
  const slot = useKidRightSlot()
  const { label, Icon } = LESSON_TYPE_META[lesson.type]
  const earnable = mode === 'play' && lesson.gamificationEnabled && lesson.xp !== null && lesson.xp > 0

  return (
    <div className="lp" data-testid="lesson-player" data-mode={mode} data-type={lesson.type}>
      {slot && mode !== 'done'
        ? createPortal(
            mode === 'play' ? (
              <ActiveTimeRing
                seconds={clock.displaySeconds}
                minSeconds={clock.minTimeSeconds}
                timeMet={clock.timeMet}
                pause={clock.pause}
              />
            ) : (
              <span className="lp-replay-pill" data-testid="replay-pill">
                Replay
              </span>
            ),
            slot,
          )
        : null}

      <PausedNotice reason={mode === 'play' ? clock.pause : null} />

      <div className="lp-meta">
        <span className="rm-chip">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
        {earnable ? (
          <span className="rm-chip" data-testid="xp-chip">
            <Sparkles className="size-3.5" aria-hidden />+{lesson.xp} XP
          </span>
        ) : null}
        {mode === 'play' && clock.minTimeSeconds > 0 ? (
          <span className="rm-chip">
            <Clock className="size-3.5" aria-hidden />
            At least {clockText(clock.minTimeSeconds)}
          </span>
        ) : null}
      </div>

      {mode === 'replay' ? (
        <p className="lp-replay" data-testid="replay-note">
          <RotateCcw className="size-5 flex-none" aria-hidden />
          You finished this lesson. Replay it any time. There is no XP this time.
        </p>
      ) : null}

      {lesson.summary ? <p className="lp-summary">{lesson.summary}</p> : null}

      <div className="lp-body">{children}</div>
      {bar}
    </div>
  )
}
