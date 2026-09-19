import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { coursesQueryKey, type Course } from './useCourses'
import { usersQueryKey } from './useUsers'

export type Enrollment = Tables<'enrollments'>
export type Badge = Tables<'badges'>

export interface UserStatsRow {
  total_xp: number
  level: number
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  lessons_completed: number
}

export interface UserProfileDetail {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  phone_number: string | null
  role: string
  created_at: string
  /** Non-null = in the trash (migration 013). Admins can still open the page. */
  deleted_at: string | null
  // Left-joined: most users have earned no XP yet, and that is not an
  // error state — see fn_process_xp_transaction, which only creates this
  // row on a user's first xp_transactions insert.
  user_stats: UserStatsRow | null
}

export interface EnrollmentWithCourse extends Enrollment {
  courses: { id: string; title: string; access_type: string; access_duration_days: number | null } | null
}

export interface BadgeWithDetails {
  id: string
  unlocked_at: string
  badges: Badge
}

export interface CourseProgress {
  courseId: string
  completed: number
  /** Published lessons only — see rules.md on why this isn't courses.total_lessons. */
  totalPublished: number
}

function detailKey(userId: string) {
  return [...usersQueryKey, userId] as const
}
function enrollmentsKey(userId: string) {
  return ['admin', 'userDetail', 'enrollments', userId] as const
}
function progressKey(userId: string, courseIds: string[]) {
  return ['admin', 'userDetail', 'progress', userId, [...courseIds].sort().join(',')] as const
}
function badgesKey(userId: string) {
  return ['admin', 'userDetail', 'badges', userId] as const
}

/**
 * One profile plus its user_stats, independent of the list page's cache —
 * this has to work on a direct link or a refresh, not just navigation from
 * an already-populated /admin/users. Mirrors useCourse(courseId) alongside
 * useCourses() for the same reason.
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: detailKey(userId),
    queryFn: async (): Promise<UserProfileDetail | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, email, avatar_url, phone_number, role, created_at, deleted_at, user_stats(total_xp, level, current_streak, longest_streak, last_activity_date, lessons_completed)',
        )
        .eq('id', userId)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) return null
      // PostgREST returns a to-one embed as an object (or null), matching
      // user_stats.user_id being both PK and FK — not an array to unwrap.
      return data as unknown as UserProfileDetail
    },
  })
}

export function useUserEnrollments(userId: string) {
  return useQuery({
    queryKey: enrollmentsKey(userId),
    // Guards the "no user picked yet" case (e.g. AddOrderDialog, where this
    // is called before a student is selected) — without it, an empty
    // string still fires as `user_id=eq.`, which Postgres rejects outright
    // (invalid input syntax for type uuid) rather than just returning no
    // rows.
    enabled: userId.length > 0,
    queryFn: async (): Promise<EnrollmentWithCourse[]> => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, courses(id, title, access_type, access_duration_days)')
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as EnrollmentWithCourse[]
    },
  })
}

/**
 * Per-course completed/published-lesson counts, for the Progress section.
 * Takes the enrolled course ids as an argument (from useUserEnrollments)
 * rather than re-fetching enrollments itself — the two queries stay
 * decoupled, and this one naturally refetches whenever the enrolled set
 * changes because those ids are part of its query key.
 *
 * The denominator is LIVE published lessons only — not trashed, and not under
 * a trashed topic (trashing a topic hides its lessons without marking them) —
 * never courses.total_lessons (that counter includes drafts a student was
 * never shown — see schema.md). The completed count is intersected against that same
 * published-id set client-side, so a lesson_progress row completed before
 * its lesson was unpublished can't inflate the numerator either.
 */
export function useUserProgress(userId: string, courseIds: string[]) {
  return useQuery({
    queryKey: progressKey(userId, courseIds),
    enabled: courseIds.length > 0,
    queryFn: async (): Promise<CourseProgress[]> => {
      const [{ data: lessons, error: lessonsError }, { data: completed, error: completedError }] =
        await Promise.all([
          supabase
            .from('lessons')
            .select('id, course_id, modules(deleted_at)')
            .in('course_id', courseIds)
            .eq('status', 'published')
            .is('deleted_at', null),
          supabase
            .from('lesson_progress')
            .select('lesson_id, course_id')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .in('course_id', courseIds),
        ])

      if (lessonsError) throw new Error(lessonsError.message)
      if (completedError) throw new Error(completedError.message)

      const publishedIdsByCourse = new Map<string, Set<string>>()
      for (const lesson of lessons ?? []) {
        // Under a trashed topic: hidden from students, so not in the denominator.
        if (lesson.modules?.deleted_at) continue
        const set = publishedIdsByCourse.get(lesson.course_id) ?? new Set<string>()
        set.add(lesson.id)
        publishedIdsByCourse.set(lesson.course_id, set)
      }

      const completedByCourse = new Map<string, number>()
      for (const row of completed ?? []) {
        const publishedIds = publishedIdsByCourse.get(row.course_id)
        if (publishedIds?.has(row.lesson_id)) {
          completedByCourse.set(row.course_id, (completedByCourse.get(row.course_id) ?? 0) + 1)
        }
      }

      return courseIds.map((courseId) => ({
        courseId,
        completed: completedByCourse.get(courseId) ?? 0,
        totalPublished: publishedIdsByCourse.get(courseId)?.size ?? 0,
      }))
    },
  })
}

export function useUserBadges(userId: string) {
  return useQuery({
    queryKey: badgesKey(userId),
    queryFn: async (): Promise<BadgeWithDetails[]> => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('id, unlocked_at, badges(*)')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as BadgeWithDetails[]
    },
  })
}

/** Postgres unique-violation — the (user_id, course_id) pair already has a row. */
const UNIQUE_VIOLATION = '23505'

/**
 * Which courses a given user can validly be enrolled in right now: published
 * only (a draft has no content ready to hand a student, an archived one is
 * retired), and not one they already have any enrollment row for, in any
 * status — the unique `(user_id, course_id)` constraint means offering one
 * of those is a guaranteed failure even if the existing row was revoked.
 *
 * Shared between `EnrollCourseDialog.tsx` (manual enroll, from the user
 * detail page) and `AddOrderDialog.tsx` (manual order, from Orders &
 * Payments) — both pickers are gated by the exact same constraint, so this
 * lives in one place rather than as two copies that could quietly drift.
 */
export function filterEnrollableCourses(courses: Course[], alreadyEnrolledIds: string[]): Course[] {
  const enrolledSet = new Set(alreadyEnrolledIds)
  return courses.filter((c) => c.status === 'published' && !enrolledSet.has(c.id))
}

/**
 * Straight through RLS (enrollments_admin_insert, migration 004), no Edge
 * Function — there is nothing here that needs service_role. expires_at is
 * computed here, once, at insert time from the course's own access fields;
 * it is never read live from courses later, so a subsequent change to a
 * course's access_duration_days can't retroactively alter an existing
 * learner's access window. See rules.md.
 */
export function useEnrollUser(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (course: {
      id: string
      access_type: string
      access_duration_days: number | null
    }) => {
      const expiresAt =
        course.access_type === 'fixed' && course.access_duration_days != null
          ? new Date(Date.now() + course.access_duration_days * 86_400_000).toISOString()
          : null

      const { error } = await supabase.from('enrollments').insert({
        user_id: userId,
        course_id: course.id,
        source: 'manual',
        status: 'active',
        expires_at: expiresAt,
      })

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          throw new Error(
            'Already enrolled in this course. Revoke the existing enrollment first if you need to re-enroll them.',
          )
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrollmentsKey(userId) })
      queryClient.invalidateQueries({ queryKey: coursesQueryKey })
      toast.success('Enrolled.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

/**
 * Straight through RLS (enrollments_admin_update), no Edge Function. The
 * total_students decrement is trigger-maintained
 * (fn_update_course_student_count) on any move away from 'active' — this
 * mutation only flips the status column.
 */
export function useRevokeEnrollment(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'revoked' })
        .eq('id', enrollmentId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrollmentsKey(userId) })
      queryClient.invalidateQueries({ queryKey: coursesQueryKey })
      toast.success('Enrollment revoked.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

/**
 * Straight through RLS (xp_transactions_admin_manual_insert), no Edge
 * Function — the policy's WITH CHECK already pins source_type = 'manual',
 * so an admin can't spoof a 'lesson'/'quiz'/'game' award through this path.
 *
 * source_id is left null: the dedupe unique index only applies WHERE
 * source_id IS NOT NULL, so manual awards are never deduped by the
 * database — a double submit is a double award. Protected only by
 * disabling the button while the mutation is in flight; that's judged
 * sufficient rather than adding schema-level dedup for a low-frequency
 * admin action (see rules.md).
 */
export function useAwardXp(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      const { error } = await supabase.from('xp_transactions').insert({
        user_id: userId,
        amount,
        reason,
        source_type: 'manual',
        source_id: null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      // total_xp/level/streak roll up via fn_process_xp_transaction, and
      // fn_evaluate_badges runs in the same trigger, so a manual award can
      // unlock a badge too — both this profile and the badges list need a
      // refetch, plus the list page's XP/Level column.
      queryClient.invalidateQueries({ queryKey: detailKey(userId) })
      queryClient.invalidateQueries({ queryKey: badgesKey(userId) })
      queryClient.invalidateQueries({ queryKey: usersQueryKey })
      toast.success('XP awarded.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
