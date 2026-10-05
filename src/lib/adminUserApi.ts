import { AdminActionError, AdminNetworkError, invokeEdgeFunction } from './edgeFunction'

export { AdminActionError, AdminNetworkError }

const FUNCTION_NAME = 'admin-user-management'

export type UserRole = 'student' | 'admin'

interface EdgeSuccess {
  success: true
  user?: { id: string; email: string | null }
}

type BulkRowStatus = 'created' | 'skipped_exists' | 'skipped_trashed' | 'failed'

/** One row's outcome from `bulk_create`. `index` is the row's position in the request. */
export interface BulkRowResult {
  index: number
  email: string
  status: BulkRowStatus
  /** Machine-readable reason for a `failed` row. */
  code?: string
  reason?: string
  /** Present only when the server generated the password. Never log or persist it. */
  generated_password?: string
  /** The account exists but its phone number could not be saved. */
  warning?: 'phone_not_saved'
}

export interface BulkCreateInputRow {
  display_name: string
  email: string
  phone_number: string
  /** Blank = the server generates one. */
  password: string
}

interface BulkCreateSuccess extends EdgeSuccess {
  results: BulkRowResult[]
}

interface CreateUserInput {
  email: string
  password: string
  display_name: string
  role: UserRole
}

/** Invokes admin-user-management with the shared `{ action, payload }` envelope (`lib/edgeFunction.ts` does the actual unwrapping). */
function invokeAdminAction(
  action: 'create' | 'bulk_create' | 'update_email' | 'update_password' | 'trash' | 'restore' | 'delete',
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<EdgeSuccess> {
  return invokeEdgeFunction<EdgeSuccess>(FUNCTION_NAME, { action, payload }, options)
}

export function createUser(input: CreateUserInput) {
  return invokeAdminAction('create', { ...input })
}

/**
 * Creates up to 25 student accounts and returns one result per row. The result
 * can carry generated passwords, so callers must keep it in memory only — never
 * log it, put it in a toast or an error message, or write it to a cache.
 */
export async function bulkCreateUsers(rows: BulkCreateInputRow[]): Promise<BulkRowResult[]> {
  // 25 accounts take roughly 5–15 s; a minute without an answer means the
  // response is lost, and the import runner then retries the chunk.
  const data = (await invokeAdminAction('bulk_create', { rows }, { timeoutMs: 60_000 })) as BulkCreateSuccess
  return data.results
}

export function updateUserEmail(userId: string, newEmail: string) {
  return invokeAdminAction('update_email', { userId, newEmail })
}

export function updateUserPassword(userId: string, newPassword: string) {
  return invokeAdminAction('update_password', { userId, newPassword })
}

/** Move a user to the trash: flags the profile, bans the login, revokes sessions. */
export function trashUser(userId: string) {
  return invokeAdminAction('trash', { userId })
}

/** Undo a trash: lifts the ban and clears the flags. */
export function restoreUser(userId: string) {
  return invokeAdminAction('restore', { userId })
}

/**
 * Permanent delete. The server only allows it for a user already in the
 * trash who has no activity history.
 */
export function deleteUser(userId: string) {
  return invokeAdminAction('delete', { userId })
}
