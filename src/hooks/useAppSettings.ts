import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type AppSettings = Tables<'app_settings'>

export const appSettingsQueryKey = ['appSettings'] as const

/**
 * `app_settings` (migration 010) is a deliberate singleton — one row, no
 * INSERT policy for any client role, so `.single()` is safe rather than a
 * defensive `.maybeSingle()`: RLS itself guarantees exactly one row can
 * ever exist. Its SELECT policy is public (`using (true)`, no `to`
 * restriction), unlike everything else under `hooks/admin/` — `site_name`
 * specifically needs to be readable before any session exists, so this
 * hook lives outside the admin-scoped query-key namespace on purpose, even
 * though its only consumers today (`AdminLayout`, the Settings Platform
 * tab) happen to sit in admin-adjacent files.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsQueryKey,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from('app_settings').select('*').single()
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export interface UpdateAppSettingsInput {
  id: string
  default_currency: string
  quiz_pass_threshold_percent: number
  site_name: string
  site_url: string | null
  support_email: string | null
  terms_url: string | null
  privacy_url: string | null
}

/**
 * Saves the whole row in one write — this is config, not a list of
 * independent records, so there's no per-field save affordance to wire up
 * separately. `id` comes from whatever `useAppSettings()` already loaded
 * into the form, not a hardcoded constant, so this file never needs to
 * know or duplicate the seeded row's actual id.
 */
export function useUpdateAppSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateAppSettingsInput) => {
      const { error } = await supabase.from('app_settings').update(fields).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appSettingsQueryKey })
      toast.success('Platform settings saved.')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
