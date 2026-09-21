import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Compass, WifiOff } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { Screen } from '@/components/kid/roadmap/StateScreens'

/**
 * Whole-page states of the lesson player (not enrolled, unavailable, could not
 * load). They reuse the roadmap's screen frame. `PlayerFrame` gives them the top
 * bar title and a Back that returns to the course path.
 */
export function PlayerFrame({ courseId, children }: { courseId: string; children: ReactNode }) {
  useKidHeader('Lesson', `/courses/${courseId}`)
  return <>{children}</>
}

function BackToPath({ courseId }: { courseId: string }) {
  return (
    <Link to="/courses/$courseId" params={{ courseId }} className="candy-btn kid-tap">
      Back to my path
    </Link>
  )
}

export function LessonUnavailableScreen({ courseId }: { courseId: string }) {
  return (
    <Screen
      testId="state-lesson-unavailable"
      icon={<Compass className="size-8" aria-hidden />}
      title="This lesson isn't ready"
      body="Please check back a little later. Your path is waiting for you!"
    >
      <BackToPath courseId={courseId} />
    </Screen>
  )
}

export function LessonRetryScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen
      testId="state-lesson-error"
      icon={<WifiOff className="size-8" aria-hidden />}
      title="Oops! We couldn't load your lesson"
      body="Check your internet and try again."
    >
      <button type="button" className="candy-btn kid-tap" onClick={onRetry}>
        Try again
      </button>
    </Screen>
  )
}
