import { useMemo } from 'react'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import type { LessonStateRow } from '@/lib/lessonEngine'
import type { LessonType } from '@/lib/roadmap'

export type RailRowState = 'current' | 'completed' | 'next' | 'locked'

export interface RailRow {
  id: string
  title: string
  type: LessonType
}

export interface NextLesson {
  id: string
  title: string
  /** True while the engine has not unlocked it yet — the Next button shows its title
   * either way (so there is always something to preview), but only links when false. */
  locked: boolean
}

export interface PreviousLesson {
  id: string
  title: string
}

export interface ModulePath {
  /** Null until the course content has loaded. */
  courseTitle: string | null
  /** The module's title (or "More to explore" for ungrouped lessons); null until content loads. */
  moduleTitle: string | null
  /** This module's 1-based place among the course's modules, in path order ("SECTION n"); 0 until content loads. */
  sectionNumber: number
  /** This module's lessons in course order, each with the row state the lesson shell's rail shows; null until content loads. */
  rows: Array<RailRow & { state: RailRowState }> | null
  /** Counts for THIS module only, from `fn_course_lesson_states` (published lessons only). */
  done: number
  total: number
  percent: number
  /** The open lesson's 1-based place in this module ("Lesson 2 of 5"), or 0 when unknown. */
  position: number
  /** The literal next lesson in COURSE order (any module) regardless of its lock state, or
   * null at the very last lesson — the shell's own Next button falls back to "Back to Home"
   * exactly when this is null, and only links to it once `locked` is false. */
  next: NextLesson | null
  /** The literal previous lesson in COURSE order (any module), or null at the very first
   * lesson of the course. Always open under linear unlock (everything before the current
   * lesson is already unlocked, by definition), so unlike `next` there is no lock to check. */
  previous: PreviousLesson | null
}

/**
 * Everything the lesson shell says about the lesson's surroundings: the current
 * MODULE's row list (for the rail/segmented bar) plus the course-wide next lesson
 * (for the Next button, which crosses module boundaries). Titles and section order
 * come from `useCourseRoadmap`, shared with the course page; lock state and order
 * come from the lesson states (the single source of truth) — nothing here decides
 * what is locked or what is next, it only looks it up.
 */
export function useModulePath(courseId: string, states: LessonStateRow[], lessonId: string): ModulePath {
  const screen = useCourseRoadmap(courseId)
  const moduleId = states.find((s) => s.lessonId === lessonId)?.moduleId ?? null

  return useMemo(() => {
    const inModule = states.filter((s) => s.moduleId === moduleId).sort((a, b) => a.sortIndex - b.sortIndex)
    const total = inModule.length
    const done = inModule.filter((s) => s.state === 'completed').length
    const roadmap = screen.kind === 'ready' ? screen.roadmap : null
    const sectionIndex = roadmap?.sections.findIndex((s) => s.moduleId === moduleId) ?? -1
    const section = sectionIndex >= 0 ? roadmap!.sections[sectionIndex] : null
    const byId = new Map(section?.lessons.map((l) => [l.id, l]) ?? [])
    const idx = inModule.findIndex((s) => s.lessonId === lessonId)

    const rows =
      section?.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        type: l.type,
        state: (l.id === lessonId ? 'current' : l.state === 'completed' ? 'completed' : l.state === 'locked' ? 'locked' : 'next') as RailRowState,
      })) ?? null

    const current = states.find((s) => s.lessonId === lessonId)
    const nextRow = current ? states.find((s) => s.sortIndex === current.sortIndex + 1) : undefined
    const previousRow = current ? states.find((s) => s.sortIndex === current.sortIndex - 1) : undefined
    const allLessons = roadmap?.sections.flatMap((s) => s.lessons) ?? []
    const nextDetail = nextRow ? (allLessons.find((l) => l.id === nextRow.lessonId) ?? byId.get(nextRow.lessonId)) : null
    const previousDetail = previousRow ? (allLessons.find((l) => l.id === previousRow.lessonId) ?? byId.get(previousRow.lessonId)) : null

    return {
      courseTitle: screen.kind === 'ready' ? screen.title : null,
      moduleTitle: section?.title ?? null,
      sectionNumber: sectionIndex + 1,
      rows,
      done,
      total,
      percent: total === 0 ? 0 : Math.floor((done / total) * 100),
      position: idx + 1,
      next: nextRow && nextDetail ? { id: nextDetail.id, title: nextDetail.title, locked: nextRow.state === 'locked' } : null,
      previous: previousRow && previousDetail && previousRow.state !== 'locked' ? { id: previousDetail.id, title: previousDetail.title } : null,
    }
  }, [screen, states, moduleId, lessonId])
}
