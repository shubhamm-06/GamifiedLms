import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useKidHeader } from '@/components/kid/kidHeader'
import { ContinueButton } from '@/components/kid/roadmap/ContinueButton'
import { CourseHeader } from '@/components/kid/roadmap/CourseHeader'
import { LessonSheet } from '@/components/kid/roadmap/LessonSheet'
import { RoadmapPath } from '@/components/kid/roadmap/RoadmapPath'
import {
  EmptyCourseScreen,
  NotEnrolledScreen,
  RetryScreen,
  RoadmapSkeleton,
  UnavailableScreen,
} from '@/components/kid/roadmap/StateScreens'
import { SummaryCard } from '@/components/kid/roadmap/SummaryCard'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import { useTouchEnrollment } from '@/hooks/useHomeCourse'
import { prefersReducedMotion } from '@/hooks/useMediaQuery'
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
export function CourseRoadmapView({ courseId, openLessonId }: { courseId: string; openLessonId: string | null }) {
  const screen = useCourseRoadmap(courseId)
  useKidHeader(screen.kind === 'ready' || screen.kind === 'empty' ? screen.title : '')
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
        <ReadyRoadmap
          courseId={courseId}
          title={screen.title}
          thumbnailUrl={screen.thumbnailUrl}
          roadmap={screen.roadmap}
          openLessonId={openLessonId}
        />
      )
  }
}

function ReadyRoadmap({
  courseId,
  title,
  thumbnailUrl,
  roadmap,
  openLessonId,
}: {
  courseId: string
  title: string
  thumbnailUrl: string | null
  roadmap: Roadmap
  /** From ?open=: the lesson whose sheet opens on arrival (a locked lesson the player turned away). */
  openLessonId: string | null
}) {
  const lessonsById = useMemo(
    () => new Map(roadmap.sections.flatMap((s) => s.lessons).map((l) => [l.id, l])),
    [roadmap],
  )
  const [sheetOpen, setSheetOpen] = useState(() => !!openLessonId && lessonsById.has(openLessonId))
  const [sheetLessonId, setSheetLessonId] = useState<string | null>(openLessonId)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()
  // The param only says "open this once": clear it so Back and refresh do not reopen the sheet.
  useEffect(() => {
    if (openLessonId) void navigate({ to: '.', search: {}, replace: true })
  }, [openLessonId, navigate])
  const sheetLesson = sheetLessonId ? (lessonsById.get(sheetLessonId) ?? null) : null

  // Once, on first load: bring the current lesson to the middle of the screen.
  // Skipped entirely under prefers-reduced-motion.
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current) return
    scrolled.current = true
    if (prefersReducedMotion()) return
    const node = document.querySelector('.rm-node[data-current="true"]')
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  return (
    <div className="kid-course-grid">
      <aside className="kid-summary hidden lg:block">
        <SummaryCard courseId={courseId} title={title} thumbnailUrl={thumbnailUrl} roadmap={roadmap} />
      </aside>
      <div className="kid-roadmap-col">
        <div className="lg:hidden">
          <CourseHeader title={title} thumbnailUrl={thumbnailUrl} roadmap={roadmap} />
        </div>
        <RoadmapPath
          roadmap={roadmap}
          onOpenLesson={(id) => {
            returnFocusRef.current = document.querySelector<HTMLElement>(`.rm-node[data-lesson-id="${id}"]`)
            setSheetLessonId(id)
            setSheetOpen(true)
          }}
        />
        {!roadmap.courseComplete && roadmap.currentLessonId ? (
          <div className="rm-bar lg:hidden" data-testid="continue-bar">
            <ContinueButton courseId={courseId} lessonId={roadmap.currentLessonId} />
          </div>
        ) : null}
      </div>
      <LessonSheet
        courseId={courseId}
        roadmap={roadmap}
        lesson={sheetLesson}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        returnFocusRef={returnFocusRef}
      />
    </div>
  )
}
