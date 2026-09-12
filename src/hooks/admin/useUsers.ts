import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/adminUserApi'

/** `'student' | 'admin'` are the only values `profiles_role_check` permits. */
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

export const usersQueryKey = ['admin', 'users'] as const

/**
 * Every profile in one query, then searched, filtered, sorted and paginated
 * client-side by the table — same reasoning as `useCourses`/`useGames`. The
 * account list is tiny and bounded by real signups, not by content authoring,
 * so a round-trip per keystroke buys nothing here.
 *
 * This replaced a server-side version that pushed `search`/`roleFilter`/
 * `page`/`pageSize` into the query key and filtered via PostgREST `.or()`,
 * `.eq()` and `.range()`. That also means the search term is no longer
 * interpolated into a PostgREST filter expression, so the sanitiser that
 * stripped `,()%*\` from it is gone with it — there is no longer a query
 * string for those characters to corrupt. Anything that reintroduces
 * server-side search has to reintroduce that escaping too.
 */
export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url, role, created_at, user_stats(total_xp, level)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as AdminUserRow[]
    },
  })
}
