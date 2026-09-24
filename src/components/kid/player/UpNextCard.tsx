import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import type { RoadmapLesson } from '@/lib/roadmap'
import { playerCopy } from '@/lib/playerCopy'

/**
 * A dashed card previewing the next episode, with a gold accent (this is the
 * "next-up" item, one of the two things --gold is reserved for). It links only
 * when the engine already shows that lesson open; a locked one is plain text
 * with a "Finish this one first" pill. Nothing here decides what is locked.
 */
export function UpNextCard({ next, courseId }: { next: RoadmapLesson; courseId: string }) {
  const locked = next.state === 'locked'
  const status = locked
    ? playerCopy.page.upNextLocked
    : next.state === 'completed'
      ? playerCopy.page.upNextDone
      : next.state === 'in_progress'
        ? playerCopy.page.upNextInProgress
        : playerCopy.page.upNextReady
  const body = (
    <>
      <span className="lp-upnext-icon" aria-hidden="true">
        <Sparkles className="size-7" />
      </span>
      <span className="min-w-0">
        <span className="lp-upnext-over kid-num">{playerCopy.page.upNext(next.number)}</span>
        <strong className="lp-upnext-title">{next.title}</strong>
      </span>
      <span className="lp-pill" data-tone={locked ? 'neutral' : 'teal'}>
        {status}
      </span>
    </>
  )
  return locked ? (
    <div className="lp-upnext" data-testid="up-next">
      {body}
    </div>
  ) : (
    <Link
      to="/courses/$courseId/lessons/$lessonId"
      params={{ courseId, lessonId: next.id }}
      className="lp-upnext kid-tap"
      data-testid="up-next"
    >
      {body}
    </Link>
  )
}
