import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
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
import { prefersReducedMotion } from '@/hooks/useMediaQuery'
import type { Roadmap } from '@/lib/roadmap'

/**
 * /courses/$courseId — the learning path. Reachable by URL only for now (there
 * is no home screen to link from). Everything shown comes from one content query
 * plus `fn_course_lesson_states`; nothing here decides what is locked.
 */
export function CoursePage() {
  const { courseId } = useParams({ strict: false }) as { courseId: string }
  const screen = useCourseRoadmap(courseId)
  useKidHeader(screen.kind === 'ready' || screen.kind === 'empty' ? screen.title : '')

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
        />
      )
  }
}

function ReadyRoadmap({
  courseId,
  title,
  thumbnailUrl,
  roadmap,
}: {
  courseId: string
  title: string
  thumbnailUrl: string | null
  roadmap: Roadmap
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLessonId, setSheetLessonId] = useState<string | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const lessonsById = useMemo(
    () => new Map(roadmap.sections.flatMap((s) => s.lessons).map((l) => [l.id, l])),
    [roadmap],
  )
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
