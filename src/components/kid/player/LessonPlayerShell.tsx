import type { ReactNode } from 'react'
import { useKidHeader } from '@/components/kid/kidHeader'
import type { ClockPause } from '@/hooks/useLessonClock'
import type { ModulePath } from '@/hooks/useModulePath'
import type { LessonContent } from '@/lib/lessonPlayer'
import { LessonHero } from './LessonHero'
import { ModuleLessonList } from './ModuleLessonList'
import { PausedNotice } from './PausedNotice'
import { Reveal } from './Reveal'

export type PlayerMode = 'play' | 'replay' | 'done'

interface Props {
  lesson: LessonContent
  courseId: string
  path: ModulePath
  mode: PlayerMode
  pause: ClockPause | null
  /** The activity card. */
  children: ReactNode
  /** The Next / Back to roadmap bar, only once the lesson is completed. */
  bar?: ReactNode
}

/**
 * The lesson page, single column and the same content at every size: the
 * hero, the activity card, the module's lesson list and, once the lesson is
 * done, one Next button. From lg the list becomes a sticky left column beside
 * the card. The top bar (KidLayout) carries only Back and the title. It holds
 * no rules: time, completion, XP and unlock state all come from the server.
 */
export function LessonPlayerShell({ lesson, courseId, path, mode, pause, children, bar }: Props) {
  useKidHeader(lesson.title, `/courses/${courseId}`)

  return (
    <div className="lp" data-testid="lesson-player" data-mode={mode} data-type={lesson.type}>
      <LessonHero title={lesson.title} moduleTitle={path.moduleTitle} />
      <div className="lp-layout">
        <div className="lp-main">
          <PausedNotice reason={mode === 'play' ? pause : null} />
          <Reveal className="lp-body">{children}</Reveal>
        </div>
        <div className="lp-side">
          <Reveal>
            <ModuleLessonList path={path} courseId={courseId} currentLessonId={lesson.id} />
          </Reveal>
        </div>
        {bar ? <div className="lp-bar-slot">{bar}</div> : null}
      </div>
    </div>
  )
}
