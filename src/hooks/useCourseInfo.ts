import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CourseInfo {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  thumbnailUrl: string | null
  enrollUrl: string | null
  isFree: boolean
  priceAmount: number | null
  currency: string
}

/**
 * The course info page's data for a student who is NOT enrolled: one row off
 * `courses`, every column already readable under `courses_select_published_or_admin`
 * (migration 003) — that policy has no enrollment check at all, so a published,
 * non-trashed course's `enroll_url`/price/description are exactly as readable as
 * its title always was (migration 033). `null` data means the row didn't come
 * back under RLS (draft, archived or a bad id) — the caller renders the existing
 * "not available" screen, never a distinct "doesn't exist" message, so a hidden
 * course is never revealed either way.
 */
export function useCourseInfo(courseId: string) {
  return useQuery<CourseInfo | null, Error>({
    queryKey: ['course', 'info', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, subtitle, description, thumbnail_url, enroll_url, is_free, price_amount, currency')
        .eq('id', courseId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      return {
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        thumbnailUrl: data.thumbnail_url,
        enrollUrl: data.enroll_url,
        isFree: data.is_free,
        priceAmount: data.price_amount,
        currency: data.currency,
      }
    },
  })
}

export interface MyEnrollmentHistory {
  status: string
  expiresAt: string | null
}

/**
 * The caller's own most recent `enrollments` row for this course, any status —
 * `enrollments_select_self` (migration 003) has no status filter, so a lapsed
 * ('expired') or revoked row is exactly as readable as an active one. `null`
 * means never enrolled here at all. There's no uniqueness constraint on
 * (user_id, course_id), so this orders by `enrolled_at` and takes the latest,
 * the same "most recent wins" rule `fn_home_course` itself uses.
 */
export function useMyEnrollmentHistory(courseId: string) {
  return useQuery<MyEnrollmentHistory | null, Error>({
    queryKey: ['course', 'myEnrollmentHistory', courseId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return null
      const { data, error } = await supabase
        .from('enrollments')
        .select('status, expires_at')
        .eq('user_id', session.user.id)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      return { status: data.status, expiresAt: data.expires_at }
    },
  })
}
