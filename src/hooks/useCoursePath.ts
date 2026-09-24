import { useMemo } from 'react'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import type { LessonStateRow } from '@/lib/lessonEngine'
import type { RoadmapLesson } from '@/lib/roadmap'

export interface CoursePath {
  /** From the lesson states, so they are known before any titles have loaded. */
  total: number
  done: number
  /** 1-based place of this lesson in the course order. */
  number: number
  percent: number
  /** Null until the course content has loaded (or if the course row is not readable). */
  courseTitle: string | null
  /** Every published lesson in course order, with title and state; null until loaded. */
  items: RoadmapLesson[] | null
  /** The lesson right after this one, if there is one. */
  next: RoadmapLesson | null
}

/**
 * What the lesson page shows about the course around this lesson: the
 * episode number and progress (from `fn_course_lesson_states`, the single
 * source of truth for order and lock state, published lessons only) and, once
 * the roadmap's content query has answered, titles for the path list and the
 * Up next card. It reuses `useCourseRoadmap`, so the query is shared with the
 * course page rather than duplicated. Nothing here decides what is locked.
 */
export function useCoursePath(courseId: string, states: LessonStateRow[], lessonId: string): CoursePath {
  const screen = useCourseRoadmap(courseId)
  const total = states.length
  const done = states.filter((s) => s.state === 'completed').length
  const number = states.find((s) => s.lessonId === lessonId)?.sortIndex ?? 1

  return useMemo(() => {
    const ready = screen.kind === 'ready' ? screen : null
    const items = ready ? ready.roadmap.sections.flatMap((s) => s.lessons).sort((a, b) => a.number - b.number) : null
    return {
      total,
      done,
      number,
      percent: total === 0 ? 0 : Math.floor((done / total) * 100),
      courseTitle: ready ? ready.title : null,
      items,
      next: items?.find((l) => l.number === number + 1) ?? null,
    }
  }, [screen, total, done, number])
}
