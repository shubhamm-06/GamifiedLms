import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock, Compass, WifiOff } from 'lucide-react'
import { LessonLayout } from './LessonLayout'
import { Screen } from '@/components/kid/roadmap/StateScreens'
import { playerCopy } from '@/lib/playerCopy'

/**
 * Whole-page states of the lesson player (not enrolled, expired, unavailable,
 * could not load). They reuse the roadmap's screen frame (spec Part A0: reuse
 * before building). `PlayerFrame` puts them in the lesson layout, so Back (to the
 * course path) sits where it does on every lesson page.
 */
export function PlayerFrame({ courseId, children }: { courseId: string; children: ReactNode }) {
  return (
    <LessonLayout courseId={courseId} width="doc" context={null}>
      {children}
    </LessonLayout>
  )
}

function BackToPath({ courseId }: { courseId: string }) {
  return (
    <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn kid-tap">
      {playerCopy.button.backToRoadmap}
    </Link>
  )
}

/** An enrollment found with `status = 'expired'` for this course (spec Part B10). */
export function EnrollmentExpiredScreen() {
  return (
    <Screen testId="state-expired" icon={<Clock className="size-8" aria-hidden />} title={playerCopy.edge.expired.heading} body={playerCopy.edge.expired.body}>
      <Link to="/" className="candy-btn kid-tap">
        {playerCopy.edge.expired.button}
      </Link>
    </Screen>
  )
}

/**
 * `variant="initial"`: the lesson was never available this visit (missing,
 * unpublished, wrong course) — shown before any content loaded.
 * `variant="mid-session"`: a live call (heartbeat, complete, submit) was
 * refused `lesson_unavailable` after the lesson was already on screen, most
 * likely because it was just unpublished — different, more specific copy.
 */
export function LessonUnavailableScreen({ courseId, variant = 'initial' }: { courseId: string; variant?: 'initial' | 'mid-session' }) {
  const copy = variant === 'mid-session' ? playerCopy.edge.unavailableMidSession : playerCopy.edge.unavailableInitial
  return (
    <Screen testId="state-lesson-unavailable" icon={<Compass className="size-8" aria-hidden />} title={copy.heading} body={copy.body}>
      <BackToPath courseId={courseId} />
    </Screen>
  )
}

export function LessonRetryScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen testId="state-lesson-error" icon={<WifiOff className="size-8" aria-hidden />} title={playerCopy.error.heading} body={playerCopy.error.body}>
      <button type="button" className="candy-btn kid-tap" onClick={onRetry}>
        {playerCopy.error.tryAgain}
      </button>
    </Screen>
  )
}
