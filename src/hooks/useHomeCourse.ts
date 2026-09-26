import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LessonEngineError, isRetryableEngineError, toEngineError } from '@/lib/lessonEngine'

export const homeCourseKey = ['kid', 'homeCourse'] as const

/**
 * The course Home should show: the caller's most recently used active
 * enrollment in a live, published course (`fn_home_course`, migration 022, which
 * owns the ordering and every edge case), or null when there is nothing to show
 * (no enrollment, or none in a course a student can read). It refetches each
 * time Home mounts so returning from another course picks up the newest one, but
 * not on window focus: the course on screen must not swap under the child.
 */
export function useHomeCourse() {
  return useQuery<string | null, LessonEngineError>({
    queryKey: homeCourseKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_home_course')
      if (error) throw toEngineError(error)
      return data ?? null
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: (count, error) => count < 2 && isRetryableEngineError(error),
  })
}

/**
 * Stamps `last_accessed_at` on the caller's active enrollment once each time
 * the roadmap for `courseId` opens (`fn_touch_enrollment`; students cannot
 * update `enrollments` directly). Best effort: a failure changes nothing the
 * child can see, so it is only logged. `enabled` is false until the roadmap has
 * actually loaded for an enrolled student.
 */
export function useTouchEnrollment(courseId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    void supabase.rpc('fn_touch_enrollment', { p_course_id: courseId }).then(({ error }) => {
      if (error) console.warn('Could not record course access', error.message)
    })
  }, [courseId, enabled])
}
