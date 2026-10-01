import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchCourseLessonStates, isRetryableEngineError, type LessonStateRow } from '@/lib/lessonEngine'
import { lessonEngineKeys } from '@/hooks/useLessonEngine'
import { homeCourseKey } from '@/hooks/useHomeCourse'

export const myCoursesKey = ['kid', 'myCourses'] as const

export interface MyCourse {
  id: string
  title: string
  thumbnailUrl: string | null
}

/**
 * Every course a student can switch to: their ACTIVE enrollments in live,
 * published courses, the same rule `fn_home_course` applies (migration 022), in
 * the same order (most recently used first: `last_accessed_at`, else
 * `enrolled_at`). A draft, archived or trashed course never appears. The
 * `user_id` filter is explicit because the enrollments policy also lets an
 * admin read everyone's rows.
 */
export function useMyCourses() {
  return useQuery<MyCourse[], Error>({
    queryKey: myCoursesKey,
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('signed_out')
      const { data, error } = await supabase
        .from('enrollments')
        .select(
          'id, course_id, enrolled_at, last_accessed_at, courses!inner(id, title, thumbnail_url, status, deleted_at)',
        )
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .eq('courses.status', 'published')
        .is('courses.deleted_at', null)
      if (error) throw error
      const rank = (e: { last_accessed_at: string | null; enrolled_at: string }) =>
        Date.parse(e.last_accessed_at ?? e.enrolled_at)
      return (data ?? [])
        .filter((e) => e.courses)
        .sort(
          (a, b) =>
            rank(b) - rank(a) || Date.parse(b.enrolled_at) - Date.parse(a.enrolled_at) || a.id.localeCompare(b.id),
        )
        .map((e) => ({ id: e.courses.id, title: e.courses.title, thumbnailUrl: e.courses.thumbnail_url }))
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export interface CourseProgress {
  status: 'loading' | 'error' | 'ready'
  done: number
  total: number
}

/**
 * Progress per course from `fn_course_lesson_states`, the same source the
 * roadmap uses (live, published lessons only, so a draft lesson is never in the
 * denominator). One call per course, cached under the roadmap's own key.
 */
export function useCoursesProgress(courseIds: string[]): Record<string, CourseProgress> {
  const results = useQueries({
    queries: courseIds.map((id) => ({
      queryKey: lessonEngineKeys.states(id),
      queryFn: () => fetchCourseLessonStates(id),
      retry: (count: number, error: Error) => count < 2 && isRetryableEngineError(error),
    })),
  })
  const out: Record<string, CourseProgress> = {}
  courseIds.forEach((id, i) => {
    const r = results[i]
    const rows: LessonStateRow[] | undefined = r?.data
    out[id] = rows
      ? { status: 'ready', done: rows.filter((s) => s.state === 'completed').length, total: rows.length }
      : { status: r?.isError ? 'error' : 'loading', done: 0, total: 0 }
  })
  return out
}

/**
 * Switching the active course from `/courses`: stamps the pick (`fn_touch_enrollment`,
 * the same call the roadmap makes), seeds Home's query so it opens on that course, and
 * navigates there. Shared by the mobile and desktop course lists so the one picking
 * flow (and its busy/error state) is not duplicated between them.
 */
export function useCoursePicker() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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

  return { pick: (id: string) => void pick(id), busyId, failed }
}
