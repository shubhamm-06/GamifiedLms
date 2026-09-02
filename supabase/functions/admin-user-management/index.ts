// =====================================================================
// admin-user-management — privileged user administration
//
// Every action here needs the service_role key (creating auth users,
// changing someone else's email/password, deleting accounts), so it
// cannot live in the browser. The caller's admin role is re-checked
// server-side on every request before any payload is touched — the
// client-side guard and disabled buttons are UX, this is enforcement.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

// The bootstrap admin. Deleting it would lock everyone out of the admin
// section with no way back in, so it is refused here as well as hidden
// in the UI. See PROJECT_CONTEXT.md — there is still no DB-level guard,
// so a direct service_role/dashboard delete can bypass this.
const PRIMARY_ADMIN_ID = '91392b37-91f1-4975-afda-e4c238c4d821'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'create' | 'update_email' | 'update_password' | 'delete'

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status)
}

/**
 * Maps a raw Auth/Postgres error to something safe to show a user, and
 * logs the real detail server-side. Raw driver errors can leak schema
 * and internal identifiers, so they never cross the wire.
 */
function safeError(context: string, err: unknown): string {
  console.error(`[admin-user-management] ${context}:`, err)

  const raw = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: string })?.code ?? ''

  if (code === 'email_exists' || /already been registered|already exists/i.test(raw)) {
    return 'Email already registered'
  }
  if (code === 'weak_password' || /password/i.test(raw) && /weak|short/i.test(raw)) {
    return 'Password does not meet the minimum requirements'
  }
  if (code === 'user_not_found' || /user not found/i.test(raw)) {
    return 'User not found'
  }
  if (code === 'validation_failed' || /invalid.*email/i.test(raw)) {
    return 'That email address was rejected as invalid'
  }
  return 'Something went wrong. Please try again.'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin-user-management] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return fail('Server misconfigured', 500)
  }

  // Service-role client: bypasses RLS. Used for the role lookup too, so
  // the caller's own RLS grants can never influence the check.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---------------------------------------------------------------
  // 1. Resolve the caller and confirm they are an admin.
  // ---------------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return fail('Forbidden', 403)
  }

  const { data: callerData, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    console.error('[admin-user-management] caller token rejected:', callerError)
    return fail('Forbidden', 403)
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (profileError || callerProfile?.role !== 'admin') {
    console.error(
      `[admin-user-management] non-admin caller ${callerData.user.id}:`,
      profileError ?? callerProfile?.role,
    )
    return fail('Forbidden', 403)
  }

  // ---------------------------------------------------------------
  // 2. Parse the request only after the role check passes.
  // ---------------------------------------------------------------
  let action: Action
  let payload: Record<string, unknown>
  try {
    const body = await req.json()
    action = body?.action
    payload = body?.payload ?? {}
  } catch {
    return fail('Invalid request body', 400)
  }

  try {
    switch (action) {
      // -----------------------------------------------------------
      case 'create': {
        const email = String(payload.email ?? '').trim()
        const password = String(payload.password ?? '')
        const displayName = String(payload.display_name ?? '').trim()
        const role = String(payload.role ?? '')

        if (!EMAIL_PATTERN.test(email)) return fail('Enter a valid email address', 400)
        if (password.length < MIN_PASSWORD_LENGTH) {
          return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400)
        }
        if (!displayName) return fail('Display name is required', 400)
        if (role !== 'student' && role !== 'admin') return fail('Role must be student or admin', 400)

        // display_name is read by fn_handle_new_user (migration 005) out
        // of raw_user_meta_data; without it the trigger falls back to the
        // email's local part.
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: displayName },
        })

        if (createError || !created?.user) {
          return fail(safeError('createUser', createError), 400)
        }

        // The trigger always writes role='student'; promote as a second
        // step when an admin was requested.
        if (role === 'admin') {
          const { error: roleError } = await admin
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', created.user.id)

          if (roleError) {
            // The account exists but is under-privileged. Say so plainly
            // rather than reporting a clean success.
            return fail(
              `${safeError('promote to admin', roleError)} The account was created as a student.`,
              500,
            )
          }
        }

        return json({ success: true, user: { id: created.user.id, email: created.user.email } })
      }

      // -----------------------------------------------------------
      case 'update_email': {
        const userId = String(payload.userId ?? '')
        const newEmail = String(payload.newEmail ?? '').trim()

        if (!userId) return fail('User id is required', 400)
        if (!EMAIL_PATTERN.test(newEmail)) return fail('Enter a valid email address', 400)

        const { error: authError } = await admin.auth.admin.updateUserById(userId, {
          email: newEmail,
          email_confirm: true,
        })
        if (authError) return fail(safeError('updateUserById(email)', authError), 400)

        // profiles.email is a real column (verified 2026-09-02) and is
        // NOT maintained by any trigger after signup, so it has to be
        // kept in sync by hand or the table will show a stale address.
        const { error: profileUpdateError } = await admin
          .from('profiles')
          .update({ email: newEmail })
          .eq('id', userId)

        if (profileUpdateError) {
          return fail(
            `${safeError('sync profiles.email', profileUpdateError)} The login email was changed but the profile still shows the old one.`,
            500,
          )
        }

        return json({ success: true, user: { id: userId, email: newEmail } })
      }

      // -----------------------------------------------------------
      case 'update_password': {
        const userId = String(payload.userId ?? '')
        const newPassword = String(payload.newPassword ?? '')

        if (!userId) return fail('User id is required', 400)
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
          return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400)
        }

        const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
        if (error) return fail(safeError('updateUserById(password)', error), 400)

        // Deliberately no echo of the password in the response.
        return json({ success: true })
      }

      // -----------------------------------------------------------
      case 'delete': {
        const userId = String(payload.userId ?? '')

        if (!userId) return fail('User id is required', 400)
        if (userId === PRIMARY_ADMIN_ID) {
          return fail('Cannot delete the primary admin account', 400)
        }

        // Cascades to public.profiles via profiles_id_fkey ON DELETE CASCADE.
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (error) return fail(safeError('deleteUser', error), 400)

        return json({ success: true })
      }

      // -----------------------------------------------------------
      default:
        return fail('Unknown action', 400)
    }
  } catch (err) {
    return fail(safeError(`action ${action}`, err), 500)
  }
})
