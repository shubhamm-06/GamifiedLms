import type { LessonState, LessonStateRow } from '@/lib/lessonEngine'

/**
 * Pure model for the course roadmap: merges what a student may read about the
 * course (titles, types, XP) with `fn_course_lesson_states` (the order and the
 * lock state). No I/O, no decisions about what is locked — the states function
 * is the single source of truth and this only arranges it.
 */

export type LessonType = 'video' | 'game' | 'quiz' | 'text'

export interface CourseInfo {
  id: string
  title: string
  subtitle: string | null
  thumbnailUrl: string | null
  gamificationEnabled: boolean
}

export interface ContentModule {
  id: string
  title: string
  position: number
}

export interface ContentLesson {
  id: string
  moduleId: string | null
  title: string
  contentType: string
  position: number
  minTimeSeconds: number
}

export interface CourseContent {
  /** Null when the student cannot read the course row (draft, archived, trashed). */
  course: CourseInfo | null
  modules: ContentModule[]
  lessons: ContentLesson[]
  /** `lesson_effective_xp`, keyed by lesson id. */
  xpByLesson: Record<string, number>
}

export interface RoadmapLesson {
  id: string
  /** 1-based place in the course order (the states function's sort_index). */
  number: number
  title: string
  type: LessonType
  state: LessonState
  activeSeconds: number
  minTimeSeconds: number
  /** Effective XP, or null when the course has gamification off / it is unknown. */
  xp: number | null
  /** 0..1 of the minimum time spent, or null when there is no minimum. */
  progress: number | null
}

export interface RoadmapSection {
  key: string
  moduleId: string | null
  kind: 'module' | 'more'
  /** The module's title, or "More to explore" for ungrouped lessons. */
  title: string
  /** Cycles gold, teal, coral, plum by the section's place on the page. */
  colorIndex: number
  lessons: RoadmapLesson[]
  doneCount: number
  allLocked: boolean
}

export interface Roadmap {
  sections: RoadmapSection[]
  totalLessons: number
  doneLessons: number
  percent: number
  /** The lesson Continue opens: the first in_progress one, else the first available. */
  currentLessonId: string | null
  courseComplete: boolean
  /** Effective XP of the lessons not yet completed; null when gamification is off. */
  xpAvailable: number | null
}

export const MODULE_COLOR_COUNT = 4

function asLessonType(value: string): LessonType {
  return value === 'video' || value === 'game' || value === 'quiz' ? value : 'text'
}

/**
 * Sections follow the states order exactly: a section is a run of lessons with
 * the same module, in order of first appearance, so ungrouped lessons (which
 * the database orders last) form the final "More to explore" section. A lesson
 * the student can't read details for (shouldn't happen) is left out of the
 * display but still counts, because the states function defines the denominator.
 */
export function buildRoadmap(content: CourseContent, states: LessonStateRow[]): Roadmap {
  const lessonById = new Map(content.lessons.map((l) => [l.id, l]))
  const moduleById = new Map(content.modules.map((m) => [m.id, m]))
  const gamified = content.course?.gamificationEnabled ?? true

  const sections: RoadmapSection[] = []
  const byKey = new Map<string, RoadmapSection>()

  for (const row of states) {
    const detail = lessonById.get(row.lessonId)
    if (!detail) continue
    const key = row.moduleId ?? '__more__'
    let section = byKey.get(key)
    if (!section) {
      const mod = row.moduleId ? moduleById.get(row.moduleId) : undefined
      const isModule = !!row.moduleId
      section = {
        key,
        moduleId: row.moduleId,
        kind: isModule ? 'module' : 'more',
        title: isModule ? (mod?.title ?? 'Module') : 'More to explore',
        colorIndex: sections.length % MODULE_COLOR_COUNT,
        lessons: [],
        doneCount: 0,
        allLocked: true,
      }
      byKey.set(key, section)
      sections.push(section)
    }
    const min = row.minTimeSeconds
    const xp = gamified ? (content.xpByLesson[row.lessonId] ?? null) : null
    section.lessons.push({
      id: row.lessonId,
      number: row.sortIndex,
      title: detail.title,
      type: asLessonType(detail.contentType),
      state: row.state,
      activeSeconds: row.activeSeconds,
      minTimeSeconds: min,
      xp,
      progress: min > 0 ? Math.min(1, row.activeSeconds / min) : null,
    })
    if (row.state === 'completed') section.doneCount += 1
    if (row.state !== 'locked') section.allLocked = false
  }

  const totalLessons = states.length
  const doneLessons = states.filter((s) => s.state === 'completed').length
  const current =
    states.find((s) => s.state === 'in_progress') ?? states.find((s) => s.state === 'available')
  const xpAvailable = gamified
    ? sections
        .flatMap((s) => s.lessons)
        .filter((l) => l.state !== 'completed')
        .reduce((sum, l) => sum + (l.xp ?? 0), 0)
    : null

  return {
    sections,
    totalLessons,
    doneLessons,
    percent: totalLessons === 0 ? 0 : Math.floor((doneLessons / totalLessons) * 100),
    currentLessonId: current?.lessonId ?? null,
    courseComplete: totalLessons > 0 && doneLessons === totalLessons,
    xpAvailable,
  }
}
