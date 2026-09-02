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
  action: 'create' | 'update_email' | 'update_password' | 'delete',
  payload: Record<string, unknown>,
): Promise<EdgeSuccess> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(FUNCTION_NAME, {
    body: { action, payload },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as EdgeFailure
        if (body?.error) throw new Error(body.error)
      } catch (parseError) {
        // A thrown Error here is the one above, and should propagate.
        if (parseError instanceof Error && parseError.message) throw parseError
      }
    }
    throw new Error('Could not reach the server. Please try again.')
  }

  if (!data || data.success === false) {
    throw new Error((data as EdgeFailure)?.error ?? 'The request failed.')
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

export function deleteUser(userId: string) {
  return invokeAdminAction('delete', { userId })
}
