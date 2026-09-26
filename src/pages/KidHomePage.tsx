import type { ReactNode } from 'react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { NoCoursesScreen, RetryScreen, RoadmapSkeleton } from '@/components/kid/roadmap/StateScreens'
import { useHomeCourse } from '@/hooks/useHomeCourse'
import { CourseRoadmapView } from '@/pages/CoursePage'

/** Clears the top bar title for the states that have no course (the roadmap sets its own). */
function PlainHome({ children }: { children: ReactNode }) {
  useKidHeader('')
  return <>{children}</>
}

/**
 * `/`, the kid app's Home: the roadmap of the student's most recently used
 * course (`fn_home_course` decides which). No enrollment in a course they can
 * read is a friendly empty state, not an error; exactly one enrollment is
 * simply the most recent one. A signed-out visitor never sees this: the student
 * layout route sends them to /login first, and back here afterwards.
 */
export function KidHomePage() {
  const home = useHomeCourse()

  if (home.isPending) {
    return (
      <PlainHome>
        <RoadmapSkeleton />
      </PlainHome>
    )
  }
  if (home.isError) {
    return (
      <PlainHome>
        <RetryScreen onRetry={() => void home.refetch()} />
      </PlainHome>
    )
  }
  if (!home.data) {
    return (
      <PlainHome>
        <NoCoursesScreen />
      </PlainHome>
    )
  }
  return <CourseRoadmapView courseId={home.data} openLessonId={null} />
}
