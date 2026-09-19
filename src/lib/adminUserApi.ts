import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

const FUNCTION_NAME = 'admin-user-management'

export type UserRole = 'student' | 'admin'

interface EdgeSuccess {
  success: true
  user?: { id: string; email: string | null }
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

  constructor(message: string, code?: string, blockers?: Record<string, number>) {
    super(message)
    this.name = 'AdminActionError'
    this.code = code
    this.blockers = blockers
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
  action: 'create' | 'update_email' | 'update_password' | 'trash' | 'restore' | 'delete',
  payload: Record<string, unknown>,
): Promise<EdgeSuccess> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(FUNCTION_NAME, {
    body: { action, payload },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as EdgeFailure
        if (body?.error) throw new AdminActionError(body.error, body.code, body.blockers)
      } catch (parseError) {
        // A thrown Error here is the one above, and should propagate.
        if (parseError instanceof Error && parseError.message) throw parseError
      }
    }
    throw new Error('Could not reach the server. Please try again.')
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
