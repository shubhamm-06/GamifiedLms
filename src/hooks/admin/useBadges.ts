import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Badge = Tables<'badges'>

export const badgesQueryKey = ['admin', 'badges'] as const

/**
 * The four `badges.condition_type` values the DB check constraint allows —
 * and, more importantly, the four `fn_evaluate_badges` actually knows how to
 * evaluate. `valueLabel`/`hint` are what the form's condition-value field
 * shows for each type, since "condition_value" means something different
 * for each (XP vs days vs lessons vs courses).
 */
export type BadgeConditionType =
  | 'total_xp'
  | 'streak_days'
  | 'lessons_completed'
  | 'course_complete'

export const CONDITION_TYPES: Record<
  BadgeConditionType,
  { label: string; valueLabel: string; hint: string }
> = {
  total_xp: {
    label: 'Total XP',
    valueLabel: 'Total XP',
    hint: "Unlocks once a student's lifetime XP reaches this.",
  },
  streak_days: {
    label: 'Streak',
    valueLabel: 'Consecutive days',
    hint: "Unlocks once a student's current streak reaches this many days.",
  },
  lessons_completed: {
    label: 'Lessons completed',
    valueLabel: 'Lessons completed',
    hint: 'Unlocks once a student has completed this many lessons overall.',
  },
  course_complete: {
    label: 'Course completion',
    valueLabel: 'Courses completed',
    hint: 'Unlocks once a student has finished every published lesson in this many of their courses.',
  },
}

export const CONDITION_TYPE_KEYS = Object.keys(CONDITION_TYPES) as BadgeConditionType[]

export function isConditionType(value: string): value is BadgeConditionType {
  return (CONDITION_TYPE_KEYS as string[]).includes(value)
}

/** A plain-language summary for the badge list — "5 lessons completed", "7-day streak", "100 XP", "Finish a course" — rather than the raw `condition_type`/`condition_value` pair. */
export function describeCondition(type: string, value: number): string {
  if (!isConditionType(type)) return `${type}: ${value}`
  switch (type) {
    case 'lessons_completed':
      return `${value} ${value === 1 ? 'lesson' : 'lessons'} completed`
    case 'streak_days':
      return `${value}-day streak`
    case 'total_xp':
      return `${value} XP`
    case 'course_complete':
      return 'Finish a course'
  }
}

/** Postgres unique-violation — surfaced as an inline slug error, not a toast. */
const UNIQUE_VIOLATION = '23505'
export const SLUG_TAKEN = 'SLUG_TAKEN'

/** Postgres FK violation — a badge some student already unlocked can't be deleted. */

function mapWriteError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION && error.message.includes('slug')) {
    return new Error(SLUG_TAKEN)
  }
  return new Error(error.message)
}

/** Every badge in one query, client-side sorted/filtered — same reasoning as `useGames`/`useCourses`. */
export function useBadges() {
  return useQuery({
    queryKey: badgesQueryKey,
    queryFn: async (): Promise<Badge[]> => {
      // Trashed badges live on /admin/trash (migration 013); an admin's RLS can
      // read them, so the filter is what hides them here.
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .is('deleted_at', null)
        .order('name')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export interface BadgeFormValues {
  name: string
  slug: string
  description: string
  icon_url: string
  condition_type: BadgeConditionType
  condition_value: string
  is_active: boolean
}

function toRow(values: BadgeFormValues) {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || null,
    icon_url: values.icon_url.trim() || null,
    condition_type: values.condition_type,
    condition_value: Number(values.condition_value),
    is_active: values.is_active,
  }
}

function useBadgesInvalidator() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: badgesQueryKey })
}

export function useCreateBadge() {
  const invalidate = useBadgesInvalidator()
  return useMutation({
    mutationFn: async (values: BadgeFormValues): Promise<Badge> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('badges')
        .insert({ ...toRow(values), created_by: user?.id ?? null })
        .select()
        .single()

      if (error) throw mapWriteError(error)
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Badge added.')
    },
  })
}

export function useUpdateBadge() {
  const invalidate = useBadgesInvalidator()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BadgeFormValues }) => {
      const { error } = await supabase.from('badges').update(toRow(values)).eq('id', id)
      if (error) throw mapWriteError(error)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Badge saved.')
    },
  })
}

/**
 * The non-destructive alternative to delete: `fn_evaluate_badges` only loops
 * `is_active` badges, so deactivating stops new unlocks without touching
 * anyone who already earned it.
 */
export function useSetBadgeActive() {
  const invalidate = useBadgesInvalidator()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('badges').update({ is_active: isActive }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  })
}
