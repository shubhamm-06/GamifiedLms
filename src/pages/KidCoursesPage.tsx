import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronRight } from 'lucide-react'
import { useKidHeader } from '@/components/kid/kidHeader'
import { NoCoursesScreen, RetryScreen } from '@/components/kid/roadmap/StateScreens'
import { Skeleton } from '@/components/ui/skeleton'
import { homeCourseKey } from '@/hooks/useHomeCourse'
import { useCoursesProgress, useMyCourses, type CourseProgress, type MyCourse } from '@/hooks/useMyCourses'
import { supabase } from '@/lib/supabase'

/**
 * `/courses`: every course the student is actively enrolled in (draft, archived
 * and trashed ones never show, the same rule as Home). Tapping one stamps it as
 * the most recently used course (`fn_touch_enrollment`, the same call the roadmap
 * makes) and goes Home, which then shows it.
 */
export function KidCoursesPage() {
  useKidHeader('Courses')
  const courses = useMyCourses()

  if (courses.isPending) {
    return (
      <div className="kc-list" aria-busy="true" aria-label="Loading your courses">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[26px] bg-ink/10" />
        ))}
      </div>
    )
  }
  if (courses.isError) {
    return <RetryScreen title="Oops! We couldn't load your courses" onRetry={() => void courses.refetch()} />
  }
  if (courses.data.length === 0) return <NoCoursesScreen />
  return <CourseList courses={courses.data} />
}

function CourseList({ courses }: { courses: MyCourse[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const progress = useCoursesProgress(courses.map((c) => c.id))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function pick(courseId: string) {
    if (busyId) return
    setBusyId(courseId)
    setFailed(false)
    const { error } = await supabase.rpc('fn_touch_enrollment', { p_course_id: courseId })
    if (error) {
      setBusyId(null)
      setFailed(true)
      return
    }
    // Home reads this key before it refetches, so it opens on the course just picked.
    queryClient.setQueryData(homeCourseKey, courseId)
    void navigate({ to: '/' })
  }

  return (
    <div className="kc-list" data-testid="course-list">
      {failed ? (
        <p className="kc-error" role="alert">
          We couldn&apos;t open that course. Please try again.
        </p>
      ) : null}
      {courses.map((course) => (
        <CourseRow
          key={course.id}
          course={course}
          progress={progress[course.id]}
          busy={busyId === course.id}
          onPick={() => void pick(course.id)}
        />
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
                ? 'No lessons yet'
                : `${progress.done} of ${progress.total} ${progress.total === 1 ? 'lesson' : 'lessons'}`}
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
