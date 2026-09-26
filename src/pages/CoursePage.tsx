import { useEffect } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useKidHeader } from '@/components/kid/kidHeader'
import { RoadmapPath } from '@/components/kid/roadmap/RoadmapPath'
import {
  EmptyCourseScreen,
  NotEnrolledScreen,
  RetryScreen,
  RoadmapSkeleton,
  UnavailableScreen,
} from '@/components/kid/roadmap/StateScreens'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import { useTouchEnrollment } from '@/hooks/useHomeCourse'
import type { Roadmap } from '@/lib/roadmap'

/**
 * /courses/$courseId: the same roadmap as Home, kept as a deep link (the
 * locked-lesson redirect and the player's Back land here). Home renders it too,
 * for the most recently used course.
 */
export function CoursePage() {
  const { courseId } = useParams({ strict: false }) as { courseId: string }
  const { open } = useSearch({ strict: false }) as { open?: string }
  return <CourseRoadmapView courseId={courseId} openLessonId={open ?? null} />
}

/**
 * The learning path for one course. Everything shown comes from one content
 * query plus `fn_course_lesson_states`; nothing here decides what is locked.
 * Opening it for an enrolled student stamps `enrollments.last_accessed_at`
 * (what Home uses to pick the course), once per open.
 */
export function CourseRoadmapView({
  courseId,
  openLessonId,
  showTitle = true,
}: {
  courseId: string
  openLessonId: string | null
  /** Home shows the course name in its stat bar instead, so it turns the top bar title off. */
  showTitle?: boolean
}) {
  const screen = useCourseRoadmap(courseId)
  useKidHeader(showTitle && (screen.kind === 'ready' || screen.kind === 'empty') ? screen.title : '')
  useTouchEnrollment(courseId, screen.kind === 'ready' || screen.kind === 'empty')

  switch (screen.kind) {
    case 'loading':
      return <RoadmapSkeleton />
    case 'not_enrolled':
      return <NotEnrolledScreen />
    case 'unavailable':
      return <UnavailableScreen />
    case 'error':
      return <RetryScreen onRetry={screen.retry} />
    case 'empty':
      return <EmptyCourseScreen />
    case 'ready':
      return (
        <ReadyRoadmap courseId={courseId} roadmap={screen.roadmap} openLessonId={openLessonId} />
      )
  }
}

function ReadyRoadmap({
  courseId,
  roadmap,
  openLessonId,
}: {
  courseId: string
  roadmap: Roadmap
  /** From ?open=: a locked lesson the player turned away, scrolled to and wiggled once. */
  openLessonId: string | null
}) {
  const navigate = useNavigate()
  // The param only says "show this once": clear it so Back and refresh do not repeat it.
  // resetScroll: false, or the router would jump to the top and undo the path's scroll.
  useEffect(() => {
    if (openLessonId) void navigate({ to: '.', search: {}, replace: true, resetScroll: false })
  }, [openLessonId, navigate])

  // No header block and no Continue button: the screen starts at the first module
  // bar, and the path itself scrolls to and opens the next step (RoadmapPath).
  return <RoadmapPath roadmap={roadmap} courseId={courseId} focusLessonId={openLessonId} />
}
