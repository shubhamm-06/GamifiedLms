import { BookOpen, ChevronRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useKidHeader } from '@/components/kid/kidHeader'
import { DesktopCourses, DesktopCoursesSkeleton } from '@/components/kid/courses/DesktopCourses'
import { NoCoursesScreen, RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/currency'
import {
  useCoursePicker,
  useCoursesProgress,
  useExploreList,
  useMyCourses,
  type CourseProgress,
  type ExploreCourse,
  type MyCourse,
} from '@/hooks/useMyCourses'
import { LG_UP, useMediaQuery } from '@/hooks/useMediaQuery'
import { getTerms as t } from '@/lib/settings/terms'

/**
 * `/courses`: every course the student is actively enrolled in (draft, archived
 * and trashed ones never show, the same rule as Home), then an "Explore courses"
 * section for every other visible course — a student not enrolled anywhere still
 * has somewhere to go here, not just the bare "No courses yet" message. Tapping
 * an enrolled course stamps it as most recently used (`fn_touch_enrollment`, the
 * roadmap's own call) and goes Home; tapping an Explore one opens its info page
 * (`/courses/$courseId`, `CourseGate`). From 1024px `DesktopCourses` lays out the
 * same data as a grid (`useMediaQuery`, the same switch every desktop screen
 * uses, so only one view is ever mounted).
 */
export function KidCoursesPage() {
  useKidHeader(t().terms('course'))
  const desktop = useMediaQuery(LG_UP)
  const courses = useMyCourses()
  const enrolledIds = (courses.data ?? []).map((c) => c.id)
  const explore = useExploreList(enrolledIds)

  if (courses.isPending) {
    return desktop ? (
      <DesktopCoursesSkeleton />
    ) : (
      <div className="kc-list" aria-busy="true" aria-label={`Loading your ${t().lower('course', true)}`}>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[26px] bg-ink/10" />
        ))}
      </div>
    )
  }
  if (courses.isError) {
    return <RetryScreen title={`Oops! We couldn't load your ${t().lower('course', true)}`} onRetry={() => void courses.refetch()} />
  }

  const hasEnrolled = courses.data.length > 0
  const hasExplore = (explore.courses?.length ?? 0) > 0
  // Both lists truly empty, and Explore has settled (not just "still loading"): the bare empty state.
  if (!hasEnrolled && !hasExplore && !explore.isPending) return <NoCoursesScreen />

  return desktop ? (
    <DesktopCourses courses={courses.data} explore={explore.courses} />
  ) : (
    <div className="kc-page">
      {hasEnrolled ? <CourseList courses={courses.data} /> : null}
      <ExploreSection courses={explore.courses} />
    </div>
  )
}

function CourseList({ courses }: { courses: MyCourse[] }) {
  const progress = useCoursesProgress(courses.map((c) => c.id))
  const { pick, busyId, failed } = useCoursePicker()

  return (
    <div className="kc-list" data-testid="course-list">
      {failed ? (
        <p className="kc-error" role="alert">
          We couldn&apos;t open that course. Please try again.
        </p>
      ) : null}
      {courses.map((course) => (
        <CourseRow key={course.id} course={course} progress={progress[course.id]} busy={busyId === course.id} onPick={() => pick(course.id)} />
      ))}
    </div>
  )
}

function CourseRow({
  course,
  progress,
  busy,
  onPick,
}: {
  course: MyCourse
  progress: CourseProgress
  busy: boolean
  onPick: () => void
}) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
  return (
    <button
      type="button"
      className="kc-row kid-card kid-tap"
      onClick={onPick}
      aria-busy={busy}
      data-testid="course-row"
      data-course-id={course.id}
    >
      <span className="kc-thumb" aria-hidden>
        {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : <BookOpen className="size-8" />}
      </span>
      <span className="kc-body">
        <span className="kc-title">{course.title}</span>
        {progress.status === 'ready' ? (
          <>
            <span
              className="kc-bar"
              role="progressbar"
              aria-label={`${course.title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span className="kc-bar-fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="kc-meta" data-testid="course-progress">
              {progress.total === 0
                ? `No ${t().lower('lesson', true)} yet`
                : `${progress.done} of ${progress.total} ${t().lower('lesson', progress.total !== 1)}`}
            </span>
          </>
        ) : progress.status === 'loading' ? (
          <Skeleton className="h-4 w-3/4 rounded-full bg-ink/10" />
        ) : null}
      </span>
      <ChevronRight className="kc-chevron size-6 flex-none" aria-hidden />
    </button>
  )
}

/** Visible courses the student isn't enrolled in. Hidden entirely (no heading) when there are none. */
function ExploreSection({ courses }: { courses: ExploreCourse[] | undefined }) {
  if (!courses || courses.length === 0) return null
  return (
    <section className="kc-explore" aria-label={`Explore ${t().lower('course', true)}`} data-testid="explore-section">
      <h2 className="kc-explore-title">Explore {t().lower('course', true)}</h2>
      <div className="kc-list">
        {courses.map((course) => (
          <ExploreRow key={course.id} course={course} />
        ))}
      </div>
    </section>
  )
}

function ExploreRow({ course }: { course: ExploreCourse }) {
  return (
    <Link
      to="/courses/$courseId"
      params={{ courseId: course.slug }}
      className="kc-row kid-card kid-tap"
      data-testid="explore-row"
      data-course-id={course.id}
    >
      <span className="kc-thumb" aria-hidden>
        {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : <BookOpen className="size-8" />}
      </span>
      <span className="kc-body">
        <span className="kc-title">{course.title}</span>
        <span className="kc-meta">{course.isFree ? 'Free' : course.priceAmount != null ? formatAmount(course.priceAmount, course.currency) : 'Learn more'}</span>
      </span>
      <span className="kc-view">View</span>
    </Link>
  )
}
