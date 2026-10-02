import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { courseRoadmapHref } from '@/lib/freeEnrollment'
import { courseContentKey } from '@/hooks/useCourseRoadmap'
import { homeCourseKey } from '@/hooks/useHomeCourse'
import { lessonEngineKeys } from '@/hooks/useLessonEngine'
import { myCoursesKey } from '@/hooks/useMyCourses'

/**
 * Enrolls the signed-in user in a FREE course on our own site: one call to the
 * `fn_enroll_free_course` database function (the only self-enrollment path; the enrollments
 * INSERT policy stays admin-only). Idempotent on the server, and `enroll` refuses to fire a
 * second time while one is in flight (double-submit protection; the button is disabled too).
 * On success: the course becomes the user's current one (Home picks the most recent), the
 * enrollment-derived queries are refreshed so Home and Courses show it at once, and the user lands
 * on the course's roadmap. No XP, badge or celebration: enrolling is not an achievement.
 */
export function useEnrollFreeCourse(course: { id: string; slug: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const mutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('fn_enroll_free_course', { p_course_id: course.id })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: async () => {
      queryClient.setQueryData(homeCourseKey, course.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: homeCourseKey }),
        queryClient.invalidateQueries({ queryKey: myCoursesKey }),
        queryClient.invalidateQueries({ queryKey: ['kid', 'exploreCourses'] }),
        queryClient.invalidateQueries({ queryKey: lessonEngineKeys.states(course.id) }),
        // The modules/lessons query may have been cached while not enrolled (RLS returned nothing): refetch it.
        queryClient.invalidateQueries({ queryKey: courseContentKey(course.id) }),
        queryClient.invalidateQueries({ queryKey: ['course', 'myEnrollmentHistory', course.id] }),
      ])
      router.history.push(courseRoadmapHref(course.slug))
      window.scrollTo(0, 0)
    },
  })
  return { ...mutation, enroll: () => (mutation.isPending ? undefined : mutation.mutate()) }
}
