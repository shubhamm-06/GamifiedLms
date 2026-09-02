import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/adminUserApi'

export type RoleFilter = UserRole | 'all'

export interface AdminUserRow {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  role: string
  created_at: string
  // XP and level live on user_stats, not profiles, and the row only
  // exists once a user has earned XP or completed a lesson — so this is
  // legitimately null for most accounts.
  user_stats: { total_xp: number; level: number } | null
}

export interface UseUsersParams {
  search: string
  roleFilter: RoleFilter
  page: number
  pageSize: number
}

export const usersQueryKey = ['admin', 'users'] as const

/**
 * PostgREST's `or=(...)` filter is a comma-separated, parenthesised
 * expression, so an unescaped comma or bracket in the search box would
 * corrupt the query rather than just failing to match. Wildcards are
 * stripped too, so a user typing "%" searches for a literal percent
 * instead of matching every row.
 */
function sanitiseSearchTerm(term: string): string {
  return term.replace(/[,()%*\\]/g, '').trim()
}

export function useUsers({ search, roleFilter, page, pageSize }: UseUsersParams) {
  const query = useQuery({
    queryKey: [...usersQueryKey, { search, roleFilter, page, pageSize }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = page * pageSize
      const to = from + pageSize - 1

      let request = supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url, role, created_at, user_stats(total_xp, level)', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(from, to)

      const term = sanitiseSearchTerm(search)
      if (term) {
        request = request.or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
      }

      if (roleFilter !== 'all') {
        request = request.eq('role', roleFilter)
      }

      const { data, error, count } = await request
      if (error) throw error

      return { rows: (data ?? []) as unknown as AdminUserRow[], count: count ?? 0 }
    },
  })

  return {
    data: query.data?.rows ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
  }
}
