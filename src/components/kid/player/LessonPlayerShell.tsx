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
  /** The activity card (a video lesson: the player, full-bleed). */
  children: ReactNode
  /** A video lesson's title, module, XP pill and minimum-time bar, shown right under the player. */
  info?: ReactNode
  /** The Next / Back to roadmap bar, only once the lesson is completed. */
  bar?: ReactNode
}

/**
 * The lesson page, single column and the same content at every size: the
 * hero, the activity card, the module's lesson list and, once the lesson is
 * done, one Next button. From lg the list becomes a sticky left column beside
 * the card. The top bar (KidLayout) carries only Back and the title. It holds
 * no rules: time, completion, XP and unlock state all come from the server.
 *
 * A video lesson swaps the hero and the card for the player itself, edge to edge
 * right under the top bar, with its `info` below it (title, status, description),
 * and has no module list. Its Back goes to Home (`/`) when there is no history,
 * and the top bar carries no title (the title is under the player).
 */
export function LessonPlayerShell({ lesson, courseId, path, mode, pause, children, info, bar }: Props) {
  const isVideo = lesson.type === 'video'
  useKidHeader(isVideo ? '' : lesson.title, isVideo ? '/' : `/courses/${courseId}`)

  return (
    <div className="lp" data-testid="lesson-player" data-mode={mode} data-type={lesson.type}>
      {isVideo ? null : <LessonHero title={lesson.title} moduleTitle={path.moduleTitle} />}
      <div className="lp-layout" data-video={isVideo ? 'true' : undefined}>
        <div className="lp-main">
          <PausedNotice reason={mode === 'play' ? pause : null} />
          {isVideo ? (
            <>
              <div className="lp-video-bleed">{children}</div>
              {info}
            </>
          ) : (
            <Reveal className="lp-body">{children}</Reveal>
          )}
        </div>
        {isVideo ? null : (
          <div className="lp-side">
            <Reveal>
              <ModuleLessonList path={path} courseId={courseId} currentLessonId={lesson.id} />
            </Reveal>
          </div>
        )}
        {bar ? <div className="lp-bar-slot">{bar}</div> : null}
      </div>
    </div>
  )
}
