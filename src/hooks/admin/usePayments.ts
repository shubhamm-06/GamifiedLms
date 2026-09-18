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

/**
 * The exact same status/reconciliation-status matching `OrderTable.tsx`'s
 * own column filters apply — used by CSV export so what gets exported is
 * whatever the admin currently has filtered on screen, not silently
 * everything. Kept as its own tiny function rather than reaching into the
 * table's TanStack instance for its filtered row model, since the
 * predicate itself (two exact-match checks) is simple enough that
 * duplicating it here is lower-risk than coupling export to the table
 * component's internals.
 */
export function filterPaymentsForExport(
  payments: PaymentRow[],
  statusFilter: string,
  reconciliationFilter: string,
): PaymentRow[] {
  return payments.filter(
    (p) =>
      (statusFilter === 'all' || p.status === statusFilter) &&
      (reconciliationFilter === 'all' || p.reconciliation_status === reconciliationFilter),
  )
}

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

export interface BulkReconciliationUpdate {
  ids: string[]
  reconciliation_status: string
  /**
   * Omit entirely (rather than passing `null`) to leave every selected
   * row's existing note untouched — that's what "Mark Unresolved" does
   * (no note prompt at all) and what "Mark Resolved" does when its optional
   * note field is left blank. Passing a string overwrites all selected
   * rows' notes identically.
   */
  reconciliation_note?: string | null
}

/**
 * One batched `.update(...).in('id', ids)` request, not N sequential
 * per-row updates — same "one write, not one per row" principle as the
 * curriculum reorder mutation. `fn_guard_payment_admin_update` still only
 * allows `reconciliation_status`/`reconciliation_note` to change outside
 * `service_role`, and the payload here is built explicitly from just those
 * two keys (never spread), same reasoning as `useUpdatePaymentReconciliation`.
 */
export function useBulkUpdateReconciliation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, reconciliation_status, reconciliation_note }: BulkReconciliationUpdate) => {
      const payload: { reconciliation_status: string; reconciliation_note?: string | null } = {
        reconciliation_status,
      }
      if (reconciliation_note !== undefined) payload.reconciliation_note = reconciliation_note
      const { error } = await supabase.from('payments').update(payload).in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      const n = variables.ids.length
      toast.success(`${n} order${n === 1 ? '' : 's'} updated.`)
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
 * The one and only place `fn_create_manual_order` is invoked from the
 * client. A plain async function, not a hook, specifically so both
 * `useCreateManualOrder` (below, for Add Order's single-order submit) and
 * the CSV bulk importer (`importManualOrders`) call the exact same path —
 * "reuse the exact same atomic path Add Order uses, not a parallel
 * bulk-insert implementation" only holds if there's one function to call,
 * not a hook's `mutationFn` copied a second time.
 *
 * Goes through the RPC — a single call, not two sequential `.insert()`s —
 * so the payment and enrollment can never partially succeed from the
 * client's point of view; the function's own transaction is what actually
 * guarantees that (verified live: forcing the enrollment insert to fail
 * leaves no orphaned payment row, since the friendly re-raised error is
 * never caught inside the function and so aborts the whole call — true on
 * every call site, including a bulk import, since it's the same function).
 *
 * The function is a PLAIN one, not `SECURITY DEFINER` — its two inserts run
 * under this admin's own RLS (`payments_admin_insert`,
 * `enrollments_admin_insert`), which is what should gate this, not "can call
 * this RPC". See rules.md.
 */
async function callCreateManualOrder(input: CreateManualOrderInput): Promise<string> {
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
}

function useInvalidateAfterOrder() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: paymentsQueryKey })
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    queryClient.invalidateQueries({ queryKey: coursesQueryKey })
    // Enrollment lists are keyed per-user (['admin','userDetail','enrollments',userId])
    // in useUserDetail.ts — broad-invalidate that family rather than
    // importing its private key builder.
    queryClient.invalidateQueries({ queryKey: ['admin', 'userDetail'] })
  }
}

export function useCreateManualOrder() {
  const invalidate = useInvalidateAfterOrder()
  return useMutation({
    mutationFn: callCreateManualOrder,
    onSuccess: () => {
      invalidate()
      toast.success('Order recorded.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export interface ImportOrderRow {
  email: string
  courseSlug: string
  amount: string
  currency: string
  provider: string
  note: string
}

export interface ImportRowResult {
  /** 1-based, matching a spreadsheet's row numbers (header is row 1). */
  row: number
  email: string
  success: boolean
  error?: string
}

export interface ImportOrdersResult {
  results: ImportRowResult[]
  succeededCount: number
  failedCount: number
}

/**
 * Bulk-creates orders by calling `callCreateManualOrder` once per row,
 * sequentially — not `Promise.all`, and not a parallel bulk-insert of any
 * kind. Per-row atomic, not whole-file atomic: one bad row (unknown email,
 * unknown course slug, an already-enrolled pair) is caught and recorded as
 * that row's failure without touching the rows before or after it, so 199
 * good rows ahead of a bad one are never rolled back by it.
 *
 * Email → user id and slug → course id are resolved from two lookups
 * fetched once up front, not once per row — this is the only place import
 * queries anything beyond the RPC itself.
 *
 * Known, accepted limit (see state.md): this is one RPC round-trip per row
 * from the client. Fine at the scale this project is at; a real bulk
 * import of thousands of rows at once would need a server-side path
 * instead, which nothing here builds toward speculatively.
 */
export async function importManualOrders(rows: ImportOrderRow[]): Promise<ImportOrdersResult> {
  const [{ data: profiles, error: profilesError }, { data: courses, error: coursesError }] =
    await Promise.all([
      supabase.from('profiles').select('id, email'),
      supabase.from('courses').select('id, slug'),
    ])
  if (profilesError) throw new Error(profilesError.message)
  if (coursesError) throw new Error(coursesError.message)

  const emailToUserId = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p.id]))
  const slugToCourseId = new Map((courses ?? []).map((c) => [c.slug, c.id]))

  const results: ImportRowResult[] = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2
    const email = row.email.trim()
    const slug = row.courseSlug.trim()

    const userId = emailToUserId.get(email.toLowerCase())
    if (!userId) {
      results.push({ row: rowNumber, email, success: false, error: `No user found with email "${email}".` })
      continue
    }
    const courseId = slugToCourseId.get(slug)
    if (!courseId) {
      results.push({ row: rowNumber, email, success: false, error: `No course found with slug "${slug}".` })
      continue
    }
    const amount = Number(row.amount)
    if (!row.amount.trim() || Number.isNaN(amount) || amount < 0) {
      results.push({ row: rowNumber, email, success: false, error: `Invalid amount "${row.amount}".` })
      continue
    }
    const currency = row.currency.trim()
    const provider = row.provider.trim()
    if (!currency || !provider) {
      results.push({ row: rowNumber, email, success: false, error: 'Currency and provider are required.' })
      continue
    }

    try {
      await callCreateManualOrder({
        userId,
        courseId,
        provider,
        amount,
        currency: currency.toUpperCase(),
        note: row.note.trim() || null,
      })
      results.push({ row: rowNumber, email, success: true })
    } catch (err) {
      results.push({
        row: rowNumber,
        email,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    results,
    succeededCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
  }
}

/** Invalidates the same query families `useCreateManualOrder` does, once for the whole batch rather than once per row. */
export function useInvalidateAfterImport() {
  return useInvalidateAfterOrder()
}
