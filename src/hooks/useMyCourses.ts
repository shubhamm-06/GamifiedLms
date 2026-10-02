import { useMemo, useState } from 'react'
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

export interface ExploreCourse {
  id: string
  /** The course link ends with this (`/courses/<slug>`). */
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  isFree: boolean
  priceAmount: number | null
  currency: string
}

/** Cap on the Explore list — a plain cap, not pagination (no search/filter/sort either). A little
 * more than the final cap is fetched so excluding enrolled courses still leaves a full page. */
const EXPLORE_LIMIT = 12
const EXPLORE_FETCH = EXPLORE_LIMIT + 8

/**
 * Every visible course, for the Courses screen's "Explore courses" section — the
 * same visibility rule as everywhere else (published, not trashed;
 * `courses_select_published_or_admin` has no enrollment check, so this needs no
 * student-only view or RPC). Takes no `enrolledIds`: that exclusion is the
 * caller's own `useMemo` over this plus `useMyCourses`' data (see
 * `useExploreList`), not baked into the query, so the query itself stays a
 * stable, cacheable key instead of silently going stale the moment enrolledIds
 * changes identity.
 */
function useExploreCandidates() {
  return useQuery<ExploreCourse[], Error>({
    queryKey: ['kid', 'exploreCourses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug, title, description, thumbnail_url, is_free, price_amount, currency')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(EXPLORE_FETCH)
      if (error) throw new Error(error.message)
      return (data ?? []).map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnail_url,
        isFree: c.is_free,
        priceAmount: c.price_amount,
        currency: c.currency,
      }))
    },
  })
}

/** `useExploreCandidates()` with the caller's active enrollments excluded and capped — what the
 * Courses screen actually renders. */
export function useExploreList(enrolledIds: readonly string[]) {
  const candidates = useExploreCandidates()
  const courses = useMemo(() => {
    if (!candidates.data) return undefined
    const enrolled = new Set(enrolledIds)
    return candidates.data.filter((c) => !enrolled.has(c.id)).slice(0, EXPLORE_LIMIT)
  }, [candidates.data, enrolledIds])
  return { courses, isPending: candidates.isPending, isError: candidates.isError }
}
