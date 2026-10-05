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
  phone_number: string | null
  role: string
  created_at: string
  /** Null for a live user. The list never shows trashed users; the export can. */
  deleted_at: string | null
  // XP and level live on user_stats, not profiles, and the row only
  // exists once a user has earned XP or completed a lesson — so this is
  // legitimately null for most accounts.
  user_stats: { total_xp: number; level: number } | null
}

export const usersQueryKey = ['admin', 'users'] as const

/** Which users a batched fetch returns. Trashed users live on /admin/trash. */
type UserScope = 'live' | 'trashed' | 'all'

/** PostgREST caps a response at 1000 rows, so anything bigger has to be paged. */
const BATCH_SIZE = 1000

const USER_COLUMNS =
  'id, display_name, email, avatar_url, phone_number, role, created_at, deleted_at, user_stats(total_xp, level)'

/**
 * Every profile in the scope, fetched in batches of 1000 until a short page
 * comes back. Ordered by `created_at` then `id` so paging is stable — a bare
 * `created_at` order can repeat or skip rows across a page boundary when
 * timestamps tie.
 */
export async function fetchUsers(scope: UserScope): Promise<AdminUserRow[]> {
  const all: AdminUserRow[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    let query = supabase
      .from('profiles')
      .select(USER_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + BATCH_SIZE - 1)
    // An admin's RLS lets them read trashed rows, so the scope filter is what hides them.
    if (scope === 'live') query = query.is('deleted_at', null)
    if (scope === 'trashed') query = query.not('deleted_at', 'is', null)

    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as unknown as AdminUserRow[]
    all.push(...page)
    if (page.length < BATCH_SIZE) return all
  }
}

/**
 * Every account's email and whether it is trashed, keyed by lowercased email.
 * The import preview uses it to spot rows whose email is already taken. It scans
 * all profiles (paged) rather than querying `in (emails)`: an `in` list of a
 * thousand addresses overflows the URL, and it would miss an account whose
 * stored email differs in case.
 */
export async function fetchAccountStates(): Promise<Map<string, 'active' | 'trashed'>> {
  const states = new Map<string, 'active' | 'trashed'>()
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email, deleted_at')
      .order('id')
      .range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    for (const p of page) states.set(p.email.toLowerCase(), p.deleted_at ? 'trashed' : 'active')
    if (page.length < BATCH_SIZE) return states
  }
}

/**
 * The list table's own search + role filter as a plain function, for callers
 * that need the same result outside the table (the export adds trashed users,
 * which the table never holds). Mirrors the table: a case-insensitive substring
 * match over name and email — TanStack's `includesString`, where an empty
 * search means "no filter" and nothing is trimmed — plus an exact role match.
 */
export function matchesUserFilter(user: AdminUserRow, search: string, role: RoleFilter): boolean {
  if (role !== 'all' && user.role !== role) return false
  if (!search) return true
  const needle = search.toLowerCase()
  return (
    user.display_name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
  )
}

/**
 * Every live profile, then searched, filtered, sorted and paginated
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
    queryFn: () => fetchUsers('live'),
  })
}
