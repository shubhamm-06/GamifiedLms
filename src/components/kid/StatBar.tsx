import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Flame, Sparkles } from 'lucide-react'
import { courseContentKey } from '@/hooks/useCourseRoadmap'
import { useKidProfile } from '@/hooks/useKidProfile'
import type { CourseContent } from '@/lib/roadmap'

/**
 * Home's slim top row, sticky under the kid top bar and above the module bar:
 * the current streak, lifetime XP (`user_stats.total_xp`, never level-relative)
 * and the current course's name, which is a link to the Courses screen. Stats
 * come from the Profile screen's query. The course name is read from the
 * roadmap's own cached content query (`enabled: false` never fetches), so
 * nothing is requested twice. Until the numbers arrive, or if they fail, a dash
 * stands in; a real zero shows as 0.
 *
 * The streak and XP pills belong to a gamified course (migration 030): when the
 * Home course has `gamification_enabled = false` they are not rendered, and
 * while that flag is still unknown (the roadmap query is loading, or there is
 * no course) they are not rendered either, so a pill never flashes in for a
 * course that turns out to have none. The bar keeps its fixed height and the
 * course-name link always stays.
 */
export function StatBar({ courseId }: { courseId: string | null }) {
  const profile = useKidProfile()
  const content = useQuery<CourseContent>({
    queryKey: courseContentKey(courseId ?? ''),
    queryFn: () => Promise.reject(new Error('read from the roadmap query')),
    enabled: false,
  })
  const title = content.data?.course?.title
  const showPills = content.data?.course?.gamificationEnabled === true
  const value = (n: number | undefined) => (n === undefined ? '–' : n)

  return (
    <div className="kid-statbar" data-testid="stat-bar">
      {showPills ? (
        <ul className="kid-stats">
          <li className="kid-stat" data-kind="streak" data-testid="stat-bar-streak">
            <Flame className="size-5" aria-hidden />
            <span className="kid-num">{value(profile.data?.currentStreak)}</span>
            <span className="sr-only">day streak</span>
          </li>
          <li className="kid-stat" data-kind="xp" data-testid="stat-bar-xp">
            <Sparkles className="size-5" aria-hidden />
            <span className="kid-num">{value(profile.data?.totalXp)}</span>
            <span className="sr-only">XP</span>
          </li>
        </ul>
      ) : null}
      {courseId && title ? (
        <Link to="/courses" className="kid-statbar-course kid-tap" data-testid="stat-bar-course">
          <span className="kid-statbar-course-name">{title}</span>
          <ChevronRight className="size-5 flex-none" aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}
