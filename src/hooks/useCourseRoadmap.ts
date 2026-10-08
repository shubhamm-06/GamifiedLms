import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LessonEngineError, toEngineError, isRetryableEngineError } from '@/lib/lessonEngine'
import { useFeature } from '@/hooks/useSettings'
import { buildRoadmap, type CourseContent, type Roadmap } from '@/lib/roadmap'
import { useCourseLessonStates } from '@/hooks/useLessonEngine'

export const courseContentKey = (courseId: string) => ['course', 'content', courseId] as const

/**
 * What a student may read about a course, in ONE nested request (course +
 * live modules + published lessons) plus the `lesson_effective_xp` view.
 *
 * Why the view is a second request: PostgREST cannot embed it (there is no
 * foreign-key path from `lessons` to the view — checked live, PGRST200), and
 * `schema.md` forbids the client from re-deriving the XP fallback. It is fetched
 * in parallel, unfiltered: RLS already limits it to lessons this student may
 * see. (Adding `course_id` to the view would let it be filtered — see state.md.)
 *
 * RLS already hides draft lessons from a student (migration 029; before that
 * they were readable directly). The `lessons.status = 'published'` filter is
 * kept on purpose: it also stops an admin who is enrolled from seeing drafts on
 * the student roadmap. Trashed rows and rows under a trashed module or course
 * never arrive.
 */
async function fetchCourseContent(courseId: string): Promise<CourseContent> {
  const [courseRes, xpRes] = await Promise.all([
    supabase
      .from('courses')
      .select(
        'id, title, subtitle, thumbnail_url, gamification_enabled, modules(id, title, position), lessons(id, module_id, title, content_type, position, min_time_seconds, status)',
      )
      .eq('id', courseId)
      .eq('lessons.status', 'published')
      .maybeSingle(),
    supabase.from('lesson_effective_xp').select('lesson_id, effective_xp'),
  ])
  if (courseRes.error) throw toEngineError(courseRes.error)
  if (xpRes.error) throw toEngineError(xpRes.error)

  const row = courseRes.data
  const xpByLesson: Record<string, number> = {}
  for (const x of xpRes.data ?? []) {
    if (x.lesson_id && x.effective_xp !== null) xpByLesson[x.lesson_id] = x.effective_xp
  }
  if (!row) return { course: null, modules: [], lessons: [], xpByLesson }

  return {
    course: {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      thumbnailUrl: row.thumbnail_url,
      gamificationEnabled: row.gamification_enabled,
    },
    modules: (row.modules ?? []).map((m) => ({ id: m.id, title: m.title, position: m.position })),
    lessons: (row.lessons ?? []).map((l) => ({
      id: l.id,
      moduleId: l.module_id,
      title: l.title,
      contentType: l.content_type,
      position: l.position,
      minTimeSeconds: l.min_time_seconds,
    })),
    xpByLesson,
  }
}

type RoadmapScreen =
  | { kind: 'loading' }
  | { kind: 'not_enrolled' }
  | { kind: 'unavailable' }
  | { kind: 'error'; retry: () => void }
  | { kind: 'empty'; title: string }
  | { kind: 'ready'; title: string; thumbnailUrl: string | null; roadmap: Roadmap }

/**
 * The course page's data: one content query + one `fn_course_lesson_states`
 * call, merged on the client by lesson id. Refetches on window/app focus via
 * TanStack Query's default focus manager (no native plugin).
 */
export function useCourseRoadmap(courseId: string): RoadmapScreen {
  const content = useQuery<CourseContent, LessonEngineError>({
    queryKey: courseContentKey(courseId),
    queryFn: () => fetchCourseContent(courseId),
    retry: (count, error) => count < 2 && isRetryableEngineError(error),
  })
  const states = useCourseLessonStates(courseId)
  const gamification = useFeature('gamification')
  const xp = useFeature('xp')

  const roadmap = useMemo(
    () => (content.data && states.data ? buildRoadmap(content.data, states.data, { gamification, xp }) : null),
    [content.data, states.data, gamification, xp],
  )

  // The engine's refusal decides first: not enrolled (also a trashed user) must
  // never be shown as anything else, whatever the course row says.
  if (states.error?.code === 'not_enrolled') return { kind: 'not_enrolled' }
  if (states.error?.code === 'lesson_unavailable') return { kind: 'unavailable' }
  if (states.isError || content.isError) {
    return {
      kind: 'error',
      retry: () => {
        void states.refetch()
        void content.refetch()
      },
    }
  }
  if (!content.data || !states.data || !roadmap) return { kind: 'loading' }
  // Enrolled, but the course row isn't readable (a draft or archived course:
  // the courses policy shows students published ones only). The engine now
  // refuses these too (migration 029), so this is a belt-and-braces fallback.
  if (!content.data.course) return { kind: 'unavailable' }
  if (roadmap.totalLessons === 0) return { kind: 'empty', title: content.data.course.title }
  return {
    kind: 'ready',
    title: content.data.course.title,
    thumbnailUrl: content.data.course.thumbnailUrl,
    roadmap,
  }
}
