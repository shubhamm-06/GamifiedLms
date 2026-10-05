import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { isUuid } from '@/lib/slug'
import { parseOutline, type CoursePageCourse, type OutlineModule } from '@/lib/coursePage'

/** Every column the parent-facing page reads — all already readable by a student under `courses_select_published_or_admin`. */
const COURSE_PAGE_COLUMNS =
  'id, slug, title, tagline, description, thumbnail_url, enroll_url, is_free, price_amount, currency, access_type, access_duration_days, gamification_enabled, age_min, age_max, language, learning_outcomes, requirements, faqs, instructor_name, instructor_role, instructor_bio, instructor_photo_url, page_theme, page_font, page_hidden_sections, page_layout, page_options, testimonials'

export type CourseInfo = CoursePageCourse & { id: string; slug: string }

/**
 * The course info page's data for a student who is NOT enrolled: one row off
 * `courses` (migration 033/034 columns included). `null` means the row didn't
 * come back under RLS (draft, archived or a bad id) — the caller renders the
 * existing "not available" screen, never a distinct "doesn't exist" message, so
 * a hidden course is never revealed either way.
 */
export function useCourseInfo(ref: string) {
  // `ref` is a course id or a slug (course URLs use the slug; ids keep working). Slugs are lowercase by constraint.
  const byId = isUuid(ref)
  return useQuery<CourseInfo | null, Error>({
    queryKey: ['course', 'info', ref.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(COURSE_PAGE_COLUMNS)
        .eq(byId ? 'id' : 'slug', ref.toLowerCase())
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ?? null
    },
  })
}

/**
 * The lesson outline (`fn_course_outline`, migration 034): PUBLISHED lessons only,
 * titles/types/positions/minutes and nothing else, for a course the caller may see.
 * A non-enrolled student cannot read modules or lessons directly, so this is the
 * only safe way to show "what's inside". Used by the student page and the admin
 * preview (the function lets an admin see a draft course's published lessons).
 */
export function useCourseOutline(courseId: string | undefined) {
  return useQuery<OutlineModule[], Error>({
    queryKey: ['course', 'outline', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_course_outline', { p_course_id: courseId as string })
      if (error) throw new Error(error.message)
      return parseOutline(data)
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
