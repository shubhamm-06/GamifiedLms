import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import type { Tables } from '@/lib/database.types'
import { coursesQueryKey } from './useCourses'

export type Payment = Tables<'payments'>

export interface PaymentRow extends Payment {
  // Embedded via explicit FK-name hints (`profiles!payments_user_id_fkey`,
  // `courses!payments_course_id_fkey`) — `profiles` is also reachable through
  // the `profiles_public` view, which otherwise leaves the relationship
  // ambiguous to PostgREST (same reasoning as useDashboard.ts's activity feed).
  profiles: { display_name: string } | null
  courses: { id: string; title: string } | null
}

export const paymentsQueryKey = ['admin', 'payments'] as const

const HEAD_COUNT = { count: 'exact', head: true } as const

/**
 * Every payment in one query, client-side sorted/filtered/paginated — same
 * reasoning as `useCourses`/`useGames`/`useUsers` at this data volume, and
 * the table has zero real rows today regardless.
 */
export function usePayments() {
  return useQuery({
    queryKey: paymentsQueryKey,
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          '*, profiles!payments_user_id_fkey(display_name), courses!payments_course_id_fkey(id, title)',
        )
        .order('received_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PaymentRow[]
    },
  })
}

/**
 * Moved here from `useDashboard.ts` (unchanged logic) so the Dashboard's KPI
 * card and the Orders page's KPI card can never independently drift on what
 * "revenue" means — both call this exact hook, so both mutations to that
 * definition (filters, unit handling) only ever need to happen once.
 */
export function useRevenue() {
  return useQuery({
    queryKey: [...paymentsQueryKey, 'revenue'],
    queryFn: async () => {
      // Filtered to INR deliberately: summing across currencies is
      // meaningless. If the product ever genuinely sells in another
      // currency this needs a per-currency breakdown, not a wider filter.
      //
      // Summed client-side because PostgREST aggregate functions aren't
      // guaranteed enabled on this project and adding a view/RPC would mean
      // a migration. Fine at present volume; revisit if payments grow.
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'paid')
        .eq('currency', DEFAULT_CURRENCY)

      if (error) throw error
      return (data ?? []).reduce((total, row) => total + (row.amount ?? 0), 0)
    },
  })
}

export function useUnresolvedPaymentsCount() {
  return useQuery({
    queryKey: [...paymentsQueryKey, 'unresolved-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('payments')
        .select('*', HEAD_COUNT)
        .eq('reconciliation_status', 'unresolved')
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
}

export function useFailedPaymentsCount() {
  return useQuery({
    queryKey: [...paymentsQueryKey, 'failed-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('payments')
        .select('*', HEAD_COUNT)
        .eq('status', 'failed')
      if (error) throw new Error(error.message)
      return count ?? 0
    },
  })
}

export interface ReconciliationUpdate {
  id: string
  reconciliation_status: string
  reconciliation_note: string | null
}

/**
 * The only way to *edit* an existing payment. `fn_guard_payment_admin_update`
 * (migration 004) raises on any other column changing outside
 * `service_role` — there is still no "link this payment to a user" action,
 * since `user_id` is one of the guarded columns, and still no delete action
 * (no admin delete RLS policy exists). There IS now a create path
 * (`payments_admin_insert`, migration 007) — see `useCreateManualOrder`
 * below, which goes through `fn_create_manual_order` rather than a bare
 * `.insert()` — but that's additive, not a loosening of this update guard.
 * The update payload here is written out explicitly (never spread from a
 * wider form object) so the client can't even attempt a write the trigger
 * would refuse — see rules.md.
 */
export function useUpdatePaymentReconciliation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reconciliation_status, reconciliation_note }: ReconciliationUpdate) => {
      const { error } = await supabase
        .from('payments')
        .update({ reconciliation_status, reconciliation_note })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
      // Resolving/unresolving changes the Dashboard's "needs attention"
      // unresolved-payments count too — invalidate the whole dashboard
      // query family rather than reaching into useDashboard.ts's private
      // key shape.
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      toast.success('Reconciliation updated.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export interface CreateManualOrderInput {
  userId: string
  courseId: string
  provider: string
  amount: number
  currency: string
  note: string | null
}

/**
 * Records a payment that happened outside the gateway (bank transfer, cash,
 * a goodwill comp) and the enrollment it backs, in one call. Goes through
 * `fn_create_manual_order` — a single RPC, not two sequential `.insert()`s
 * — so the payment and enrollment can never partially succeed from the
 * client's point of view; the function's own transaction is what actually
 * guarantees that (verified live: forcing the enrollment insert to fail
 * leaves no orphaned payment row, since the friendly re-raised error is
 * never caught inside the function and so aborts the whole call).
 *
 * The function is a PLAIN one, not `SECURITY DEFINER` — its two inserts run
 * under this admin's own RLS (`payments_admin_insert`,
 * `enrollments_admin_insert`), which is what should gate this, not "can call
 * this RPC". See rules.md.
 */
export function useCreateManualOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateManualOrderInput) => {
      const { data, error } = await supabase.rpc('fn_create_manual_order', {
        p_user_id: input.userId,
        p_course_id: input.courseId,
        p_provider: input.provider,
        p_amount: input.amount,
        p_currency: input.currency,
        p_note: input.note ?? undefined,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: coursesQueryKey })
      // Enrollment lists are keyed per-user (['admin','userDetail','enrollments',userId])
      // in useUserDetail.ts — broad-invalidate that family rather than
      // importing its private key builder.
      queryClient.invalidateQueries({ queryKey: ['admin', 'userDetail'] })
      toast.success('Order recorded.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
