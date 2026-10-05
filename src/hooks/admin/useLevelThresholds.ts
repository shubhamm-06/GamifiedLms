import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type LevelThreshold = Tables<'level_thresholds'>

const levelThresholdsQueryKey = ['admin', 'levelThresholds'] as const

/** Level 1 is structurally special: it must always exist and stay at 0 XP. Protected in the UI, not special-cased in SQL (see rules.md). */
export const BASE_LEVEL = 1

export function useLevelThresholds() {
  return useQuery({
    queryKey: levelThresholdsQueryKey,
    queryFn: async (): Promise<LevelThreshold[]> => {
      const { data, error } = await supabase
        .from('level_thresholds')
        .select('*')
        .order('level')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/**
 * The same strict-monotonic rule `fn_validate_level_threshold` enforces in
 * the database — checked here first purely as fast feedback in front of the
 * real trigger, never instead of it. `thresholds` is the current saved
 * list; `level` may or may not already be in it (edit vs. add). Returns an
 * error message, or null when the value is acceptable.
 */
export function validateThreshold(
  thresholds: LevelThreshold[],
  level: number,
  xpRequired: number,
): string | null {
  if (!Number.isInteger(xpRequired) || xpRequired < 0) return 'Enter a whole number, 0 or more.'

  const others = thresholds.filter((t) => t.level !== level)
  const below = others.filter((t) => t.level < level).sort((a, b) => b.level - a.level)[0]
  const above = others.filter((t) => t.level > level).sort((a, b) => a.level - b.level)[0]

  if (below && xpRequired <= below.xp_required) {
    return `Level ${level} needs more XP than level ${below.level} (${below.xp_required}).`
  }
  if (above && xpRequired >= above.xp_required) {
    return `Level ${level} needs less XP than level ${above.level} (${above.xp_required}).`
  }
  return null
}

function useThresholdsInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: levelThresholdsQueryKey })
}

// Errors from the DB's own validation trigger (check_violation) carry a
// human-readable message already ("Level 5 needs less XP than level 6
// (1119)."), so they're surfaced verbatim rather than remapped.

export function useCreateLevelThreshold() {
  const invalidate = useThresholdsInvalidator()
  return useMutation({
    mutationFn: async (row: LevelThreshold) => {
      const { error } = await supabase.from('level_thresholds').insert(row)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, row) => {
      invalidate()
      toast.success(`Level ${row.level} added.`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateLevelThreshold() {
  const invalidate = useThresholdsInvalidator()
  return useMutation({
    mutationFn: async ({ level, xp_required }: LevelThreshold) => {
      const { error } = await supabase
        .from('level_thresholds')
        .update({ xp_required })
        .eq('level', level)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, row) => {
      invalidate()
      toast.success(`Level ${row.level} saved.`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteLevelThreshold() {
  const invalidate = useThresholdsInvalidator()
  return useMutation({
    mutationFn: async (level: number) => {
      const { error } = await supabase.from('level_thresholds').delete().eq('level', level)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, level) => {
      invalidate()
      toast.success(`Level ${level} deleted.`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
