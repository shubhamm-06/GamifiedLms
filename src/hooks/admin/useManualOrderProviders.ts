import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type ManualOrderProvider = Tables<'manual_order_providers'>

export const manualOrderProvidersQueryKey = ['admin', 'manualOrderProviders'] as const

/**
 * Every row, active and inactive both — the Settings list editor needs to
 * show and toggle both; Add Order filters this down to `is_active` rows
 * itself rather than this hook having two variants.
 */
export function useManualOrderProviders() {
  return useQuery({
    queryKey: manualOrderProvidersQueryKey,
    queryFn: async (): Promise<ManualOrderProvider[]> => {
      const { data, error } = await supabase
        .from('manual_order_providers')
        .select('*')
        .order('label')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

const UNIQUE_VIOLATION = '23505'
export const LABEL_TAKEN = 'LABEL_TAKEN'

function useProvidersInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: manualOrderProvidersQueryKey })
}

export function useCreateProvider() {
  const invalidate = useProvidersInvalidator()
  return useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase.from('manual_order_providers').insert({ label })
      if (error) {
        if (error.code === UNIQUE_VIOLATION) throw new Error(LABEL_TAKEN)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.success('Provider added.')
    },
    // LABEL_TAKEN is surfaced inline by the form instead — a generic toast
    // for it would just repeat what the field's own error text already says.
    onError: (error: Error) => {
      if (error.message !== LABEL_TAKEN) toast.error(error.message)
    },
  })
}

/**
 * Deactivate hides a label temporarily without losing it — the label stays
 * addressable (and re-activatable) for admins who just want it out of the
 * dropdown for a while. Safe regardless of what it's used for:
 * `payments.provider` is a text snapshot copied at insert time, so
 * deactivating a label here changes nothing about rows that already
 * reference it in free text.
 */
export function useSetProviderActive() {
  const invalidate = useProvidersInvalidator()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('manual_order_providers')
        .update({ is_active: isActive })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  })
}

/**
 * A true hard delete, verified against the live RLS policy
 * (`manual_order_providers_admin_delete`, `FOR DELETE USING
 * (fn_is_admin())`) before adding this rather than assumed from how the
 * migration read. Safe to be a real delete, not deactivate-only:
 * `payments.provider` is deliberately plain text with no FK to this table
 * (see rules.md), so removing a label here can never touch a historical
 * payment record. Deactivate and delete serve different purposes and both
 * stay available — this doesn't replace `useSetProviderActive`.
 */
export function useDeleteProvider() {
  const invalidate = useProvidersInvalidator()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manual_order_providers').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Provider deleted.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
