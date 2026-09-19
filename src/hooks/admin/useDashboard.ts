import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatAmount } from '@/lib/currency'

/**
 * Every card gets its own query so one failing request degrades a single
 * card instead of blanking the dashboard.
 *
 * The database is currently empty apart from two profiles, so zero is the
 * expected answer nearly everywhere — the UI treats that as a normal state,
 * not a loading or error state.
 */
const key = (...parts: string[]) => ['admin', 'dashboard', ...parts]

/** Unwraps a Supabase `head: true` count query into a plain number. */
async function runCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

// Table names are written inline rather than passed as a parameter: a union
// of table names collapses the builder's column typing to the intersection,
// so `.eq('role', ...)` would stop type-checking.
const HEAD_COUNT = { count: 'exact', head: true } as const

export function useStudentCount() {
  return useQuery({
    queryKey: key('students'),
    queryFn: () =>
      // Trashed users are out of every total (migration 013) — an admin's RLS can
      // still read them, so each count below filters deleted_at itself.
      runCount(
        supabase.from('profiles').select('*', HEAD_COUNT).eq('role', 'student').is('deleted_at', null),
      ),
  })
}

export function useCourseCounts() {
  return useQuery({
    queryKey: key('courses'),
    queryFn: async () => {
      const [published, draft] = await Promise.all([
        runCount(
          supabase.from('courses').select('*', HEAD_COUNT).eq('status', 'published').is('deleted_at', null),
        ),
        runCount(
          supabase.from('courses').select('*', HEAD_COUNT).eq('status', 'draft').is('deleted_at', null),
        ),
      ])
      return { published, draft }
    },
  })
}

export function useActiveEnrollmentCount() {
  return useQuery({
    queryKey: key('enrollments'),
    queryFn: () =>
      // Enrollments of a trashed user or in a trashed course don't count (inner
      // joins + embedded filters), matching how total_students is maintained.
      runCount(
        supabase
          .from('enrollments')
          .select(
            '*, profiles!enrollments_user_id_fkey!inner(deleted_at), courses!enrollments_course_id_fkey!inner(deleted_at)',
            HEAD_COUNT,
          )
          .eq('status', 'active')
          .filter('profiles.deleted_at', 'is', null)
          .filter('courses.deleted_at', 'is', null),
      ),
  })
}

export interface AttentionItem {
  id: 'unresolved-payments' | 'draft-courses' | 'gamification-disabled'
  count: number
  label: string
  tone: 'coral' | 'gold' | 'plum'
  to: string
}

export function useNeedsAttention() {
  return useQuery({
    queryKey: key('attention'),
    queryFn: async (): Promise<AttentionItem[]> => {
      const [unresolvedPayments, draftCourses, gamificationOff] = await Promise.all([
        runCount(
          supabase
            .from('payments')
            .select('*', HEAD_COUNT)
            .eq('reconciliation_status', 'unresolved'),
        ),
        runCount(
          supabase.from('courses').select('*', HEAD_COUNT).eq('status', 'draft').is('deleted_at', null),
        ),
        runCount(
          supabase
            .from('courses')
            .select('*', HEAD_COUNT)
            .eq('gamification_enabled', false)
            .is('deleted_at', null),
        ),
      ])

      return [
        {
          id: 'unresolved-payments',
          count: unresolvedPayments,
          label:
            unresolvedPayments === 1
              ? '1 payment is unresolved'
              : `${unresolvedPayments} payments are unresolved`,
          tone: 'coral',
          to: '/admin/orders',
        },
        {
          id: 'draft-courses',
          count: draftCourses,
          label:
            draftCourses === 1
              ? '1 course is still a draft'
              : `${draftCourses} courses are still drafts`,
          tone: 'gold',
          to: '/admin/courses',
        },
        {
          id: 'gamification-disabled',
          count: gamificationOff,
          // Wording matters: since migration 012 this flag gates lesson XP
          // (fn_award_lesson_xp) and NOTHING else — the lessons_completed
          // counter and the badges it can unlock still accrue. The item
          // exists to surface that partial enforcement, not to imply the
          // setting turns gamification off wholesale. See rules.md.
          label:
            gamificationOff === 1
              ? '1 course has gamification switched off (lesson XP is skipped, but lesson counts and badges still accrue)'
              : `${gamificationOff} courses have gamification switched off (lesson XP is skipped, but lesson counts and badges still accrue)`,
          tone: 'plum',
          to: '/admin/courses',
        },
      ].filter((item) => item.count > 0) as AttentionItem[]
    },
  })
}

export type ActivityKind = 'enrollment' | 'payment' | 'xp'

export interface ActivityRow {
  id: string
  kind: ActivityKind
  at: string
  detail: string
}

interface EnrollmentActivity {
  id: string
  enrolled_at: string
  profiles: { display_name: string } | null
  courses: { title: string } | null
}

interface PaymentActivity {
  id: string
  received_at: string
  amount: number
  currency: string
  status: string
}

interface XpActivity {
  id: string
  created_at: string
  amount: number
  reason: string
  profiles: { display_name: string } | null
}

const PAYMENT_VERB: Record<string, string> = {
  paid: 'Payment received',
  refunded: 'Payment refunded',
  failed: 'Payment failed',
}

/**
 * There's no unified activity table, so three small queries run in parallel
 * and are merged client-side. Embeds use explicit FK constraint hints
 * because `profiles` is also reachable through the `profiles_public` view,
 * which can otherwise make the relationship ambiguous to PostgREST.
 */
export function useRecentActivity(limit = 8) {
  return useQuery({
    queryKey: key('activity', String(limit)),
    queryFn: async (): Promise<ActivityRow[]> => {
      const [enrollments, payments, xp] = await Promise.all([
        supabase
          .from('enrollments')
          .select(
            'id, enrolled_at, profiles!enrollments_user_id_fkey(display_name), courses!enrollments_course_id_fkey(title)',
          )
          .order('enrolled_at', { ascending: false })
          .limit(5),
        supabase
          .from('payments')
          .select('id, received_at, amount, currency, status')
          .order('received_at', { ascending: false })
          .limit(5),
        supabase
          .from('xp_transactions')
          .select('id, created_at, amount, reason, profiles!xp_transactions_user_id_fkey(display_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (enrollments.error) throw enrollments.error
      if (payments.error) throw payments.error
      if (xp.error) throw xp.error

      const rows: ActivityRow[] = [
        ...((enrollments.data ?? []) as unknown as EnrollmentActivity[]).map((row) => ({
          id: `enrollment-${row.id}`,
          kind: 'enrollment' as const,
          at: row.enrolled_at,
          detail: `${row.profiles?.display_name ?? 'Someone'} enrolled in ${
            row.courses?.title ?? 'a course'
          }`,
        })),
        ...((payments.data ?? []) as unknown as PaymentActivity[]).map((row) => ({
          id: `payment-${row.id}`,
          kind: 'payment' as const,
          at: row.received_at,
          detail: `${PAYMENT_VERB[row.status] ?? 'Payment'} — ${formatAmount(
            row.amount,
            row.currency,
          )}`,
        })),
        ...((xp.data ?? []) as unknown as XpActivity[]).map((row) => ({
          id: `xp-${row.id}`,
          kind: 'xp' as const,
          at: row.created_at,
          detail: `${row.profiles?.display_name ?? 'Someone'} earned ${row.amount} XP — ${row.reason}`,
        })),
      ]

      return rows
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, limit)
    },
  })
}
