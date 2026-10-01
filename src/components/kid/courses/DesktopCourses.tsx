import { BookOpen, ChevronRight, Compass } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { DesktopPageHeader } from '@/components/kid/DesktopPageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/currency'
import { useCoursePicker, useCoursesProgress, type CourseProgress, type ExploreCourse, type MyCourse } from '@/hooks/useMyCourses'

/**
 * `/courses` at >= 1024px: the same enrollments as mobile (`useMyCourses`,
 * `useCoursesProgress`), as a grid instead of a single-column list. Same action as
 * mobile — tapping a card calls `fn_touch_enrollment` and goes Home — through the
 * shared `useCoursePicker` hook, so the mobile list and this grid cannot drift
 * apart on how a switch happens.
 *
 * "Current course" (the one gold card, labelled, with a badge) is `courses[0]`:
 * `useMyCourses` already orders by `last_accessed_at` — "the same order
 * fn_home_course applies" per its own doc comment — so the first entry is the
 * course Home would open, with no second query. Every other card is a plain
 * secondary link to switch to it, matching mobile's own chevron-only rows (mobile
 * has no per-row action label at all, current or not).
 */
export function DesktopCourses({ courses, explore }: { courses: MyCourse[]; explore: ExploreCourse[] | undefined }) {
  const progress = useCoursesProgress(courses.map((c) => c.id))
  const { pick, busyId, failed } = useCoursePicker()
  const currentId = courses[0]?.id

  return (
    <div className="kcd" data-testid="courses-desktop">
      <DesktopPageHeader title="Courses" />
      {failed ? (
        <p className="kc-error" role="alert">
          We couldn&apos;t open that course. Please try again.
        </p>
      ) : null}
      {courses.length > 0 ? (
        <ul className="kcd-grid" data-testid="course-grid">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              progress={progress[course.id]}
              current={course.id === currentId}
              busy={busyId === course.id}
              onPick={() => pick(course.id)}
            />
          ))}
        </ul>
      ) : null}
      <ExploreSection courses={explore} />
    </div>
  )
}

/** Visible courses the student isn't enrolled in. Hidden entirely (no heading) when there are none. */
function ExploreSection({ courses }: { courses: ExploreCourse[] | undefined }) {
  if (!courses || courses.length === 0) return null
  return (
    <section className="kcd-explore" aria-label="Explore courses" data-testid="explore-section">
      <h2 className="kcd-explore-title">Explore courses</h2>
      <ul className="kcd-grid">
        {courses.map((course) => (
          <ExploreCard key={course.id} course={course} />
        ))}
      </ul>
    </section>
  )
}

function ExploreCard({ course }: { course: ExploreCourse }) {
  return (
    <li>
      <Link to="/courses/$courseId" params={{ courseId: course.id }} className="kcd-card kid-tap" data-testid="explore-card" data-course-id={course.id}>
        <span className="kcd-thumb" aria-hidden>
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : <BookOpen className="size-8" />}
        </span>
        <span className="kcd-title" title={course.title}>
          {course.title}
        </span>
        {course.description ? <span className="kcd-explore-desc">{course.description}</span> : null}
        <span className="kcd-action" data-tone="quiet">
          {course.isFree ? 'Free' : course.priceAmount != null ? formatAmount(course.priceAmount, course.currency) : 'View'}
          <ChevronRight aria-hidden />
        </span>
      </Link>
    </li>
  )
}

function CourseCard({
  course,
  progress,
  current,
  busy,
  onPick,
}: {
  course: MyCourse
  progress: CourseProgress
  current: boolean
  busy: boolean
  onPick: () => void
}) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
  // "Review" for a finished course, "Continue" for one in progress, "Start" otherwise —
  // the same three words Home already uses for the same three states (lessonTypeMeta's
  // sibling, actionLabel in DesktopHome.tsx), reused here rather than inventing new wording.
  const done = progress.status === 'ready' && progress.total > 0 && progress.done === progress.total
  const started = progress.status === 'ready' && progress.done > 0
  return (
    <li>
      <button
        type="button"
        className="kcd-card kid-tap"
        data-current={current ? 'true' : undefined}
        onClick={onPick}
        aria-busy={busy}
        data-testid="course-card"
        data-course-id={course.id}
      >
        <span className="kcd-thumb" aria-hidden>
          {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" loading="lazy" /> : <BookOpen className="size-8" />}
        </span>
        {current ? (
          <span className="kcd-current">
            <Compass className="size-4" aria-hidden />
            Current course
          </span>
        ) : null}
        <span className="kcd-title" title={course.title}>
          {course.title}
        </span>
        {progress.status === 'ready' ? (
          <div className="kcd-progress">
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
            <span className="kcd-meta" data-testid="course-progress">
              {progress.total === 0 ? 'No lessons yet' : `${progress.done} of ${progress.total} ${progress.total === 1 ? 'lesson' : 'lessons'}`}
            </span>
          </div>
        ) : progress.status === 'loading' ? (
          <Skeleton className="h-4 w-3/4 rounded-full bg-ink/10" />
        ) : null}
        <span className="kcd-action" data-tone={current ? 'gold' : 'quiet'}>
          {current ? (done ? 'Review' : started ? 'Continue' : 'Start') : 'Switch to this course'}
          <ChevronRight aria-hidden />
        </span>
      </button>
    </li>
  )
}

export function DesktopCoursesSkeleton() {
  return (
    <div className="kcd" data-testid="courses-desktop-skeleton" aria-busy="true" aria-label="Loading your courses">
      <DesktopPageHeader title="Courses" />
      <ul className="kcd-grid">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="h-64 w-full rounded-[22px] bg-ink/10" />
          </li>
        ))}
      </ul>
    </div>
  )
}
