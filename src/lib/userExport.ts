import { download, localDateStamp, toCsv, type CsvColumn } from '@/lib/csv'
import { fetchUsers, matchesUserFilter, type AdminUserRow, type RoleFilter } from '@/hooks/admin/useUsers'

/**
 * Exported columns. `xp` and `level` come from `user_stats`, whose row only
 * exists once someone has earned XP, so a user without one exports blanks
 * (not zeros — they are not "level 0"). Deliberately no password, hash, token
 * or avatar: nothing secret or bulky ever leaves through this file.
 */
const USER_EXPORT_COLUMNS: CsvColumn<AdminUserRow>[] = [
  { header: 'id', value: (u) => u.id },
  { header: 'display_name', value: (u) => u.display_name },
  { header: 'email', value: (u) => u.email },
  { header: 'role', value: (u) => u.role },
  { header: 'xp', value: (u) => u.user_stats?.total_xp },
  { header: 'level', value: (u) => u.user_stats?.level },
  { header: 'phone_number', value: (u) => u.phone_number },
  { header: 'created_at', value: (u) => u.created_at },
  { header: 'status', value: (u) => (u.deleted_at ? 'trashed' : 'active') },
]

export type ExportScope = 'selected' | 'filtered' | 'all'

export interface UserExportSource {
  /** Live users the admin ticked, in table order. */
  selected: AdminUserRow[]
  /** Live users matching the current search + role filter, in table order (all pages). */
  filtered: AdminUserRow[]
  search: string
  roleFilter: RoleFilter
}

/** `skillxp-users-YYYY-MM-DD.csv`, dated in the admin's own timezone. */
function userExportFilename(now = new Date()): string {
  return `skillxp-users-${localDateStamp(now)}.csv`
}

/**
 * Collects the rows for one export choice. `includeTrashed` adds trashed users
 * to "filtered" (those matching the same search and role) and "all". It has no
 * effect on "selected": a trashed user can't be ticked in the list.
 */
export async function collectUsersForExport(
  scope: ExportScope,
  includeTrashed: boolean,
  source: UserExportSource,
): Promise<AdminUserRow[]> {
  if (scope === 'selected') return source.selected

  if (scope === 'filtered') {
    if (!includeTrashed) return source.filtered
    const trashed = await fetchUsers('trashed')
    return [
      ...source.filtered,
      ...trashed.filter((u) => matchesUserFilter(u, source.search, source.roleFilter)),
    ]
  }

  return fetchUsers(includeTrashed ? 'all' : 'live')
}

/** Builds the CSV and hands it to the browser. Returns the row count exported. */
export function downloadUsersCsv(users: AdminUserRow[]): number {
  download(userExportFilename(), toCsv(users, USER_EXPORT_COLUMNS))
  return users.length
}
