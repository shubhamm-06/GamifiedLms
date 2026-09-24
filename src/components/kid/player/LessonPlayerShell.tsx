import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKidHeader, useKidRightSlot } from '@/components/kid/kidHeader'
import type { ClockPause } from '@/hooks/useLessonClock'
import { useCoursePath } from '@/hooks/useCoursePath'
import type { LessonStateRow } from '@/lib/lessonEngine'
import type { LessonContent } from '@/lib/lessonPlayer'
import { playerCopy } from '@/lib/playerCopy'
import { ActiveTimeRing } from './ActiveTimeRing'
import { CoursePathSidebar, CoursePathStrip } from './CoursePathNav'
import { LessonHero } from './LessonHero'
import { LessonOverviewCard } from './LessonOverviewCard'
import { PausedNotice } from './PausedNotice'
import { Reveal } from './Reveal'
import { UpNextCard } from './UpNextCard'

export type PlayerMode = 'play' | 'replay' | 'done'

interface Props {
  lesson: LessonContent
  courseId: string
  /** The course's lesson states (published lessons only), already loaded by the page. */
  states: LessonStateRow[]
  mode: PlayerMode
  clock: { displaySeconds: number; minTimeSeconds: number; timeMet: boolean; pause: ClockPause | null }
  /** The lesson's content (video, document, game or quiz). */
  children: ReactNode
  /** The bottom bar, when the page (not the quiz) owns the primary action. */
  bar?: ReactNode
}

/**
 * The frame every lesson type plays in: a hero, the course path (a strip and
 * bottom sheet below lg, a sticky sidebar from lg), an overview card, the
 * lesson itself under a "Step 1" label, an Up next card and the bottom bar.
 * The lesson title and the active-time ring stay in the top bar. It holds no
 * rules: the clock, the XP, the unlock state and the completion all come from
 * the server.
 */
export function LessonPlayerShell({ lesson, courseId, states, mode, clock, children, bar }: Props) {
  useKidHeader(lesson.title, `/courses/${courseId}`)
  const slot = useKidRightSlot()
  const path = useCoursePath(courseId, states, lesson.id)

  return (
    <div className="lp" data-testid="lesson-player" data-mode={mode} data-type={lesson.type}>
      {slot && mode !== 'done' && clock.minTimeSeconds > 0
        ? createPortal(
            <ActiveTimeRing
              seconds={mode === 'replay' ? clock.minTimeSeconds : clock.displaySeconds}
              minSeconds={clock.minTimeSeconds}
              timeMet={mode === 'replay' || clock.timeMet}
              pause={mode === 'play' ? clock.pause : null}
            />,
            slot,
          )
        : null}

      <LessonHero number={path.number} total={path.total} title={lesson.title} courseTitle={path.courseTitle} />

      <div className="lp-layout">
        <CoursePathSidebar path={path} courseId={courseId} lessonId={lesson.id} />
        <div className="lp-main">
          <PausedNotice reason={mode === 'play' ? clock.pause : null} />
          <CoursePathStrip path={path} courseId={courseId} lessonId={lesson.id} />
          <Reveal>
            <LessonOverviewCard lesson={lesson} path={path} mode={mode} minTimeSeconds={clock.minTimeSeconds} />
          </Reveal>
          <Reveal className="lp-body-wrap">
            <p className="lp-section-label">{playerCopy.page.step[lesson.type]}</p>
            <div className="lp-body">{children}</div>
          </Reveal>
          {/* The quiz owns its own sticky bar while it is played; a card after it would sit under that bar. */}
          {bar && path.next ? (
            <Reveal>
              <UpNextCard next={path.next} courseId={courseId} />
            </Reveal>
          ) : null}
          {bar}
        </div>
      </div>
    </div>
  )
}
