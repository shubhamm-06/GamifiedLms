import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import type { Tables } from '@/lib/database.types'

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
 * The only admin write path onto `payments`. `fn_guard_payment_admin_update`
 * (migration 004) raises on any other column changing outside
 * `service_role` — there is no create or delete action for this table at
 * all (no admin insert/delete RLS policy exists), and no "link this payment
 * to a user" action, since `user_id` is one of the guarded columns. The
 * update payload is written out explicitly (never spread from a wider form
 * object) so the client can't even attempt a write the trigger would refuse
 * — see rules.md.
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
