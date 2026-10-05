import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import { UNIQUE_VIOLATION, FK_VIOLATION } from '@/lib/adminConstants'

export type Currency = Tables<'currencies'>

const currenciesQueryKey = ['admin', 'currencies'] as const

/**
 * Every row, active and inactive both — the Settings list editor needs to
 * show and toggle both; the default-currency Select filters this down to
 * `is_active` rows itself, same split as `useManualOrderProviders`.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: currenciesQueryKey,
    queryFn: async (): Promise<Currency[]> => {
      const { data, error } = await supabase.from('currencies').select('*').order('code')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export const CODE_TAKEN = 'CODE_TAKEN'

function useCurrenciesInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: currenciesQueryKey })
}

export function useCreateCurrency() {
  const invalidate = useCurrenciesInvalidator()
  return useMutation({
    mutationFn: async ({ code, name }: { code: string; name: string }) => {
      const { error } = await supabase.from('currencies').insert({ code, name })
      if (error) {
        if (error.code === UNIQUE_VIOLATION) throw new Error(CODE_TAKEN)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.success('Currency added.')
    },
    // CODE_TAKEN is surfaced inline by the form instead — a generic toast
    // for it would just repeat what the field's own error text already says.
    onError: (error: Error) => {
      if (error.message !== CODE_TAKEN) toast.error(error.message)
    },
  })
}

/**
 * Deactivate hides a currency from the default-currency picker without
 * losing the row — matches `useSetProviderActive`'s exact reasoning.
 */
export function useSetCurrencyActive() {
  const invalidate = useCurrenciesInvalidator()
  return useMutation({
    mutationFn: async ({ code, isActive }: { code: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('currencies')
        .update({ is_active: isActive })
        .eq('code', code)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  })
}

/** Postgres FK violation — app_settings.default_currency references currencies(code), NO ACTION. */
export const CURRENCY_IS_DEFAULT = 'CURRENCY_IS_DEFAULT'

/**
 * A true hard delete, same as providers — nothing in this schema
 * references `currencies.code` except `app_settings.default_currency`
 * itself, and that FK is the actual guard: deleting the currency currently
 * set as the platform default is refused at the database level, not
 * pre-checked here. This mutation only maps the resulting `23503` to a
 * clear message instead of a raw Postgres error, the same established
 * pattern as the lesson-delete and payment-permanent-delete FK cases.
 */
export function useDeleteCurrency() {
  const invalidate = useCurrenciesInvalidator()
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from('currencies').delete().eq('code', code)
      if (error?.code === FK_VIOLATION) throw new Error(CURRENCY_IS_DEFAULT)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Currency deleted.')
    },
    onError: (error: Error) => {
      toast.error(
        error.message === CURRENCY_IS_DEFAULT
          ? 'This is the platform default currency — change the default first, then delete it.'
          : error.message,
      )
    },
  })
}
