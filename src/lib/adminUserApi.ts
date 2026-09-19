import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

const FUNCTION_NAME = 'admin-user-management'

export type UserRole = 'student' | 'admin'

interface EdgeSuccess {
  success: true
  user?: { id: string; email: string | null }
}

export type BulkRowStatus = 'created' | 'skipped_exists' | 'skipped_trashed' | 'failed'

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

interface EdgeFailure {
  success: false
  error: string
  /** Machine-readable reason for the removal actions (trash/restore/delete). */
  code?: string
  /** For `has_history`: the blocking row counts, keyed `table.column`. */
  blockers?: Record<string, number>
}

/** An admin action the server refused, with the reason it gave. */
export class AdminActionError extends Error {
  code?: string
  blockers?: Record<string, number>
  /** HTTP status when the refusal came from a non-2xx response. */
  status?: number

  constructor(message: string, code?: string, blockers?: Record<string, number>, status?: number) {
    super(message)
    this.name = 'AdminActionError'
    this.code = code
    this.blockers = blockers
    this.status = status
  }
}

/** The request never got a usable answer (offline, dropped connection, relay failure). */
export class AdminNetworkError extends Error {
  constructor() {
    super('Could not reach the server. Please try again.')
    this.name = 'AdminNetworkError'
  }
}

type EdgeResponse = EdgeSuccess | EdgeFailure

interface CreateUserInput {
  email: string
  password: string
  display_name: string
  role: UserRole
}

/**
 * Invokes the admin-user-management Edge Function and normalises its
 * result into "returns data" or "throws Error", so TanStack Query's
 * onError path gets a real message.
 *
 * supabase-js surfaces any non-2xx as a FunctionsHttpError whose own
 * message is just "Edge Function returned a non-2xx status code" — the
 * useful message is in the un-read response body, so it's pulled out
 * here. Without this every server-side validation error would reach the
 * user as that same meaningless string.
 */
async function invokeAdminAction(
  action: 'create' | 'bulk_create' | 'update_email' | 'update_password' | 'trash' | 'restore' | 'delete',
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<EdgeSuccess> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(FUNCTION_NAME, {
    body: { action, payload },
    // An aborted request surfaces below as a network error, not a hang.
    timeout: options?.timeoutMs,
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status
      try {
        const body = (await error.context.json()) as EdgeFailure
        if (body?.error) throw new AdminActionError(body.error, body.code, body.blockers, status)
      } catch (parseError) {
        // Only the AdminActionError thrown above should propagate; an unreadable
        // body (a gateway HTML page, say) falls through to the status-only error.
        if (parseError instanceof AdminActionError) throw parseError
      }
      // A non-2xx with no readable body (a gateway 429/502/504, say): keep the status.
      throw new AdminActionError('The request failed.', undefined, undefined, status)
    }
    throw new AdminNetworkError()
  }

  if (!data || data.success === false) {
    const failure = data as EdgeFailure | null
    throw new AdminActionError(
      failure?.error ?? 'The request failed.',
      failure?.code,
      failure?.blockers,
    )
  }

  return data
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
