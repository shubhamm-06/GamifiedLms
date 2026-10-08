import { useMemo } from 'react'
import { useCourseRoadmap } from '@/hooks/useCourseRoadmap'
import type { LessonStateRow } from '@/lib/lessonEngine'
import type { RoadmapLesson } from '@/lib/roadmap'

export interface ModulePath {
  /** The module's title (or "More to explore" for ungrouped lessons); null until content loads. */
  moduleTitle: string | null
  /** This module's published lessons in course order, with titles; null until content loads. */
  lessons: RoadmapLesson[] | null
  /** Counts for THIS module only, from `fn_course_lesson_states` (published lessons only). */
  done: number
  total: number
  percent: number
  /** The lesson the roadmap's Continue would open, when it is in this module and is not the open one. */
  nextUpId: string | null
  /** The lesson right after the open one in this module, or null when the open one is the module's last. */
  following: RoadmapLesson | null
  /** The lesson right before the open one in this module, or null when the open one is the module's first. */
  previous: RoadmapLesson | null
  /** The open lesson's 1-based place in this module ("Lesson 2 of 5"), or 0 when unknown. */
  position: number
}

/**
 * Everything the lesson page says about the lesson's surroundings, scoped to
 * the lesson's MODULE: never the whole course. Counts and order come from the
 * lesson states (the single source of truth for order and lock state);
 * titles come from `useCourseRoadmap`, shared with the course page. Nothing
 * here decides what is locked or what "next up" means: next up is the
 * roadmap's own `currentLessonId`.
 */
export function useModulePath(courseId: string, states: LessonStateRow[], lessonId: string): ModulePath {
  const screen = useCourseRoadmap(courseId)
  const moduleId = states.find((s) => s.lessonId === lessonId)?.moduleId ?? null

  return useMemo(() => {
    const inModule = states.filter((s) => s.moduleId === moduleId).sort((a, b) => a.sortIndex - b.sortIndex)
    const total = inModule.length
    const done = inModule.filter((s) => s.state === 'completed').length
    const roadmap = screen.kind === 'ready' ? screen.roadmap : null
    const section = roadmap?.sections.find((s) => s.moduleId === moduleId) ?? null
    const lessons = section ? [...section.lessons].sort((a, b) => a.number - b.number) : null
    const idx = inModule.findIndex((s) => s.lessonId === lessonId)
    const followingId = idx >= 0 && idx < inModule.length - 1 ? inModule[idx + 1].lessonId : null
    const previousId = idx > 0 ? inModule[idx - 1].lessonId : null
    const currentId = roadmap?.currentLessonId ?? null
    return {
      moduleTitle: section?.title ?? null,
      lessons,
      done,
      total,
      percent: total === 0 ? 0 : Math.floor((done / total) * 100),
      nextUpId: currentId && currentId !== lessonId && inModule.some((s) => s.lessonId === currentId) ? currentId : null,
      following: followingId ? (lessons?.find((l) => l.id === followingId) ?? null) : null,
      previous: previousId ? (lessons?.find((l) => l.id === previousId) ?? null) : null,
      position: idx + 1,
    }
  }, [screen, states, moduleId, lessonId])
}
