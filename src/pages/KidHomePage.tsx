import type { ReactNode } from 'react'
import { DesktopHome } from '@/components/kid/home/DesktopHome'
import { useKidHeader } from '@/components/kid/kidHeader'
import { StatBar } from '@/components/kid/StatBar'
import { NoCoursesScreen, RetryScreen, RoadmapSkeleton } from '@/components/kid/roadmap/StateScreens'
import { useHomeCourse } from '@/hooks/useHomeCourse'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'
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
 *
 * From 1024px (`LG_UP`) it is the list-style `DesktopHome` instead of the winding path.
 * The choice is a JS media query, not CSS hiding, so exactly one view mounts and the
 * path's auto-scroll and popover never run on desktop. Below 1024px nothing changed.
 */
export function KidHomePage() {
  const home = useHomeCourse()
  const desktop = useMediaQuery(LG_UP)
  if (desktop) return <DesktopHome home={home} />
  return (
    <div className="kid-home">
      <StatBar courseId={home.data ?? null} />
      <HomeBody home={home} />
    </div>
  )
}

function HomeBody({ home }: { home: ReturnType<typeof useHomeCourse> }) {
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
  return <CourseRoadmapView courseId={home.data} openLessonId={null} showTitle={false} />
}
