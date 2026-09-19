// =====================================================================
// admin-user-management — privileged user administration
//
// Every action here needs the service_role key (creating auth users,
// changing someone else's email/password, banning/deleting accounts), so
// it cannot live in the browser. The caller's admin role is re-checked
// server-side on every request before any payload is touched — the
// client-side guard and disabled buttons are UX, this is enforcement.
//
// Removing a user is two-step (migration 013): `trash` (flag the profile,
// ban the auth user, revoke sessions) then, only for a user already in the
// trash, `delete`. `restore` undoes a trash.
//
// `bulk_create` (CSV import) creates up to 25 student accounts per call. It
// treats the client's preview as untrusted: every row is re-validated and
// re-checked against existing/trashed accounts here. It never modifies an
// existing account, and it never logs a password (supplied or generated) —
// generated ones travel only in the response to the calling admin.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

// The bootstrap admin. Trashing or deleting it would lock everyone out of
// the admin section with no way back in, so it is refused here as well as
// hidden in the UI. There is still no DB-level guard (see docs/state.md),
// so a direct service_role/dashboard change can bypass this.
const PRIMARY_ADMIN_ID = '91392b37-91f1-4975-afda-e4c238c4d821'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The project's enforced minimum (this function, the Add user / reset dialogs
// and the signup page all use 8). GoTrue's own configured minimum is looser
// (6, read from its weak_password error), so this is the stricter of the two.
const MIN_PASSWORD_LENGTH = 8

// Import limits. The client enforces the same numbers; these are the real ones.
const MAX_BULK_ROWS = 25
const MAX_DISPLAY_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 254
// Digits with an optional leading +, after formatting characters are removed.
const PHONE_PATTERN = /^\+?\d{7,15}$/
const GENERATED_PASSWORD_LENGTH = 20

// ~100 years. GoTrue takes a Go duration string; 'none' lifts a ban.
const BAN_DURATION = '876000h'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action =
  | 'create'
  | 'bulk_create'
  | 'update_email'
  | 'update_password'
  | 'trash'
  | 'restore'
  | 'delete'

/**
 * Machine-readable failure codes the client can branch on (the human
 * message is in `error`). Only the removal actions use them.
 */
type ErrorCode =
  | 'not_found'
  | 'self_target'
  | 'primary_admin'
  | 'last_admin'
  | 'already_trashed'
  | 'not_trashed'
  | 'has_history'

function json(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
  })
}

function fail(
  error: string,
  status: number,
  code?: ErrorCode,
  extra?: Record<string, unknown>,
): Response {
  return json({ success: false, error, ...(code ? { code } : {}), ...(extra ?? {}) }, status)
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

type AdminClient = ReturnType<typeof createClient>

/**
 * The one place an account is created — `create` and `bulk_create` both go
 * through it, so they cannot drift. The email is marked confirmed (an admin
 * vouches for it). display_name rides in user metadata: fn_handle_new_user
 * (migration 005) copies it into the profile, always with role 'student'; an
 * admin is promoted afterwards by `create` alone. Returns the raw Auth result
 * so each caller can map the error its own way.
 */
function createAuthUser(
  admin: AdminClient,
  input: { email: string; password: string; displayName: string },
) {
  return admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  })
}

// No I/O/l/0/1: a password read off a printed sheet should not be ambiguous.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/**
 * Crypto-random password (20 chars from a 57-symbol alphabet, ~117 bits) with
 * at least one upper, lower and digit. Bytes >= 228 are discarded so every
 * symbol is equally likely (256 % 57 would otherwise bias the first ones).
 * The alphabet has no `= + - @`, so a CSV formula guard can never alter it.
 */
function generatePassword(): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length)
  for (;;) {
    let out = ''
    while (out.length < GENERATED_PASSWORD_LENGTH) {
      const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_PASSWORD_LENGTH * 2))
      for (const b of bytes) {
        if (b < limit && out.length < GENERATED_PASSWORD_LENGTH) {
          out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]
        }
      }
    }
    if (/[A-Z]/.test(out) && /[a-z]/.test(out) && /\d/.test(out)) return out
  }
}

/** Strips spaces, dots, dashes and brackets, then checks digits with an optional leading +. */
function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s().-]/g, '')
  return PHONE_PATTERN.test(stripped) ? stripped : null
}

/** Escapes `\`, `%` and `_` so an email is matched literally by ILIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

type BulkStatus = 'created' | 'skipped_exists' | 'skipped_trashed' | 'failed'
type BulkCode =
  | 'invalid_row'
  | 'invalid_display_name'
  | 'invalid_email'
  | 'invalid_phone'
  | 'weak_password'
  | 'duplicate_in_request'
  | 'create_failed'

const BULK_REASONS: Record<BulkCode, string> = {
  invalid_row: 'This row could not be read',
  invalid_display_name: `Name is required and must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
  invalid_email: 'Enter a valid email address',
  invalid_phone: 'Phone number must be digits with an optional leading +',
  weak_password: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  duplicate_in_request: 'This email appears more than once in the request',
  create_failed: 'The account could not be created',
}

interface BulkRowResult {
  /** Position of the row in the request, so the client can map it back to a file row. */
  index: number
  email: string
  status: BulkStatus
  code?: BulkCode
  reason?: string
  user_id?: string
  /** Set only when the server generated the password. Never logged. */
  generated_password?: string
  /** The account exists but its phone number could not be saved. */
  warning?: 'phone_not_saved'
}

function bulkFailure(index: number, email: string, code: BulkCode): BulkRowResult {
  return { index, email, status: 'failed', code, reason: BULK_REASONS[code] }
}

/**
 * Creates student accounts for up to MAX_BULK_ROWS rows and reports each one.
 * One bad row never aborts the rest. Existing accounts are skipped, never
 * touched. Throws only when the up-front existing-email lookup fails, before
 * anything has been created.
 *
 * Logging rule: nothing here passes a row, a password or an Auth error object
 * to the console — only the row index and the error's code/status.
 */
async function bulkCreate(admin: AdminClient, rawRows: unknown[]): Promise<BulkRowResult[]> {
  const results: BulkRowResult[] = new Array(rawRows.length)

  type Candidate = {
    index: number
    email: string
    displayName: string
    phone: string | null
    suppliedPassword: string
  }
  const candidates: Candidate[] = []
  const seen = new Set<string>()

  // 1. Re-validate every row (the client preview is untrusted).
  rawRows.forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      results[index] = bulkFailure(index, '', 'invalid_row')
      return
    }
    const row = raw as Record<string, unknown>
    const displayName = String(row.display_name ?? '').trim()
    const email = String(row.email ?? '').trim().toLowerCase()
    const phoneRaw = String(row.phone_number ?? '').trim()
    const password = typeof row.password === 'string' ? row.password : ''

    if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      results[index] = bulkFailure(index, email, 'invalid_display_name')
      return
    }
    if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
      results[index] = bulkFailure(index, email, 'invalid_email')
      return
    }
    let phone: string | null = null
    if (phoneRaw) {
      phone = normalizePhone(phoneRaw)
      if (!phone) {
        results[index] = bulkFailure(index, email, 'invalid_phone')
        return
      }
    }
    // A blank (or whitespace-only) password means "generate one".
    if (password.trim() !== '' && password.length < MIN_PASSWORD_LENGTH) {
      results[index] = bulkFailure(index, email, 'weak_password')
      return
    }
    if (seen.has(email)) {
      results[index] = bulkFailure(index, email, 'duplicate_in_request')
      return
    }
    seen.add(email)
    candidates.push({
      index,
      email,
      displayName,
      phone,
      suppliedPassword: password.trim() === '' ? '' : password,
    })
  })

  // 2. One lookup for accounts that already exist, trashed ones included.
  const existing = new Map<string, boolean>() // email -> is trashed
  if (candidates.length > 0) {
    const { data, error } = await admin
      .from('profiles')
      .select('email, deleted_at')
      .in('email', candidates.map((c) => c.email))
    if (error) throw error
    for (const p of data ?? []) existing.set(String(p.email).toLowerCase(), p.deleted_at !== null)
  }

  // 3. Create one at a time so a duplicate can never race itself.
  for (const c of candidates) {
    const known = existing.get(c.email)
    if (known !== undefined) {
      results[c.index] = {
        index: c.index,
        email: c.email,
        status: known ? 'skipped_trashed' : 'skipped_exists',
      }
      continue
    }

    const generated = c.suppliedPassword === ''
    const password = generated ? generatePassword() : c.suppliedPassword

    const { data: created, error: createError } = await createAuthUser(admin, {
      email: c.email,
      password,
      displayName: c.displayName,
    })

    if (createError || !created?.user) {
      const authCode = (createError as { code?: string } | null)?.code ?? ''
      const authStatus = (createError as { status?: number } | null)?.status ?? 0
      console.error(`[admin-user-management] bulk_create row ${c.index} failed:`, {
        code: authCode,
        status: authStatus,
      })

      if (authCode === 'email_exists' || (authStatus === 422 && /already/i.test(createError?.message ?? ''))) {
        // Lost a race with another signup/import, or the address belongs to an
        // auth user with no profile. Classify by whatever profile exists.
        const { data: race } = await admin
          .from('profiles')
          .select('deleted_at')
          .ilike('email', escapeLike(c.email))
          .maybeSingle()
        results[c.index] = {
          index: c.index,
          email: c.email,
          status: race?.deleted_at ? 'skipped_trashed' : 'skipped_exists',
        }
      } else if (authCode === 'weak_password') {
        results[c.index] = bulkFailure(c.index, c.email, 'weak_password')
      } else {
        results[c.index] = bulkFailure(c.index, c.email, 'create_failed')
      }
      continue
    }

    const result: BulkRowResult = {
      index: c.index,
      email: c.email,
      status: 'created',
      user_id: created.user.id,
    }
    if (generated) result.generated_password = password

    // The trigger built the profile (role student, CSV display_name). The phone
    // is set afterwards; if that fails the account must be kept, not orphaned.
    if (c.phone) {
      const { data: updated, error: phoneError } = await admin
        .from('profiles')
        .update({ phone_number: c.phone })
        .eq('id', created.user.id)
        .select('id')
      if (phoneError || !updated || updated.length !== 1) {
        console.error(`[admin-user-management] bulk_create row ${c.index} phone not saved`)
        result.warning = 'phone_not_saved'
      }
    }

    results[c.index] = result
  }

  return results
}

// Every table with a row that references a profile and would make the
// auth.users -> profiles cascade fail (all NO ACTION). deleted_by is
// ON DELETE SET NULL and deliberately not here.
const HISTORY_CHECKS: {
  table: string
  column: string
  singular: string
  plural: string
}[] = [
  { table: 'enrollments', column: 'user_id', singular: 'enrollment', plural: 'enrollments' },
  { table: 'payments', column: 'user_id', singular: 'payment', plural: 'payments' },
  {
    table: 'lesson_progress',
    column: 'user_id',
    singular: 'lesson progress record',
    plural: 'lesson progress records',
  },
  { table: 'quiz_attempts', column: 'user_id', singular: 'quiz attempt', plural: 'quiz attempts' },
  {
    table: 'xp_transactions',
    column: 'user_id',
    singular: 'XP transaction',
    plural: 'XP transactions',
  },
  { table: 'user_stats', column: 'user_id', singular: 'stats record', plural: 'stats records' },
  { table: 'user_badges', column: 'user_id', singular: 'earned badge', plural: 'earned badges' },
  { table: 'courses', column: 'created_by', singular: 'course created', plural: 'courses created' },
  { table: 'games', column: 'created_by', singular: 'game created', plural: 'games created' },
  { table: 'badges', column: 'created_by', singular: 'badge created', plural: 'badges created' },
]

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
  const callerId = callerData.user.id

  // A trashed admin keeps a valid access token until it expires, so being
  // an admin is not enough: the caller must also not be trashed.
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, deleted_at')
    .eq('id', callerId)
    .single()

  if (profileError || callerProfile?.role !== 'admin' || callerProfile?.deleted_at) {
    console.error(
      `[admin-user-management] non-admin or trashed caller ${callerId}:`,
      profileError ?? callerProfile,
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

  // Shared by trash / restore / delete: load the target profile.
  type Target = { id: string; role: string; deleted_at: string | null }
  async function loadTarget(userId: string): Promise<Target | Response> {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role, deleted_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) return fail(safeError('load target profile', error), 500)
    if (!data) return fail('User not found', 404, 'not_found')
    return data as Target
  }

  // Guards for taking a user out of circulation (trash AND delete). Order
  // matters only for which message wins: self, then primary, then last.
  async function removalGuards(target: Target): Promise<Response | null> {
    if (target.id === callerId) {
      return fail('You cannot do this to your own account', 400, 'self_target')
    }
    if (target.id === PRIMARY_ADMIN_ID) {
      return fail('The primary admin account cannot be trashed or deleted', 400, 'primary_admin')
    }
    if (target.role === 'admin') {
      // Would this leave no other non-trashed admin?
      const { count, error } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .is('deleted_at', null)
        .neq('id', target.id)
      if (error) return fail(safeError('count remaining admins', error), 500)
      if ((count ?? 0) === 0) {
        return fail('The last remaining admin cannot be trashed or deleted', 400, 'last_admin')
      }
    }
    return null
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

        const { data: created, error: createError } = await createAuthUser(admin, {
          email,
          password,
          displayName,
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
      // CSV import: up to MAX_BULK_ROWS student accounts per call, one result
      // per row. The response can carry generated passwords, so it must never
      // be cached or logged.
      case 'bulk_create': {
        const rows = payload.rows
        if (!Array.isArray(rows) || rows.length === 0) return fail('No rows to import', 400)
        if (rows.length > MAX_BULK_ROWS) {
          return fail(`At most ${MAX_BULK_ROWS} rows can be imported per request`, 400)
        }
        const results = await bulkCreate(admin, rows)
        return json({ success: true, results }, 200, { 'Cache-Control': 'no-store' })
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
      // Move a user to the trash: flag the profile, ban the auth user so
      // they cannot sign in or refresh a token, and revoke live sessions.
      case 'trash': {
        const userId = String(payload.userId ?? '')
        if (!userId) return fail('User id is required', 400)

        const target = await loadTarget(userId)
        if (target instanceof Response) return target
        if (target.deleted_at) return fail('This user is already in the trash', 409, 'already_trashed')

        const blocked = await removalGuards(target)
        if (blocked) return blocked

        // 1. Flag the profile. deleted_by is the VERIFIED caller from the
        //    JWT, never a client-supplied value; the DB guard trigger only
        //    lets service_role write these two columns.
        const { data: flagged, error: flagError } = await admin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString(), deleted_by: callerId })
          .eq('id', userId)
          .is('deleted_at', null)
          .select('id')
        if (flagError) return fail(safeError('flag profile trashed', flagError), 500)
        if (!flagged || flagged.length === 0) {
          return fail('This user is already in the trash', 409, 'already_trashed')
        }

        // 2. Ban. If it fails, roll the flag back so the two never disagree.
        const { error: banError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: BAN_DURATION,
        })
        if (banError) {
          const { error: rollbackError } = await admin
            .from('profiles')
            .update({ deleted_at: null, deleted_by: null })
            .eq('id', userId)
          if (rollbackError) console.error('[admin-user-management] trash rollback failed:', rollbackError)
          return fail(`${safeError('ban user', banError)} The user was not moved to the trash.`, 500)
        }

        // 3. Revoke sessions. A banned user cannot refresh, and RLS already
        //    cuts a trashed user off, so a failure here is reported but does
        //    not undo the trash.
        const { error: revokeError } = await admin.rpc('fn_revoke_user_sessions', {
          p_user_id: userId,
        })
        if (revokeError) console.error('[admin-user-management] revoke sessions failed:', revokeError)

        return json({ success: true, user: { id: userId }, sessionsRevoked: !revokeError })
      }

      // -----------------------------------------------------------
      case 'restore': {
        const userId = String(payload.userId ?? '')
        if (!userId) return fail('User id is required', 400)

        const target = await loadTarget(userId)
        if (target instanceof Response) return target
        if (!target.deleted_at) return fail('This user is not in the trash', 409, 'not_trashed')

        // Unban first: if it fails nothing has changed. If clearing the
        // flags then fails, re-ban so the user is not half-restored.
        const { error: unbanError } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        })
        if (unbanError) return fail(safeError('unban user', unbanError), 500)

        const { error: clearError } = await admin
          .from('profiles')
          .update({ deleted_at: null, deleted_by: null })
          .eq('id', userId)
        if (clearError) {
          await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION })
          return fail(`${safeError('clear trash flags', clearError)} The user is still in the trash.`, 500)
        }

        return json({ success: true, user: { id: userId } })
      }

      // -----------------------------------------------------------
      // Permanent delete: only for a user already in the trash, and only
      // if nothing references them (the FKs are NO ACTION, so the cascade
      // from auth.users would fail on the first child row).
      case 'delete': {
        const userId = String(payload.userId ?? '')
        if (!userId) return fail('User id is required', 400)

        const target = await loadTarget(userId)
        if (target instanceof Response) return target

        const blocked = await removalGuards(target)
        if (blocked) return blocked

        if (!target.deleted_at) {
          return fail(
            'Move this user to the trash before deleting them permanently',
            409,
            'not_trashed',
          )
        }

        const counts = await Promise.all(
          HISTORY_CHECKS.map(async (check) => {
            const { count, error } = await admin
              .from(check.table)
              .select('*', { count: 'exact', head: true })
              .eq(check.column, userId)
            if (error) throw error
            return { check, count: count ?? 0 }
          }),
        )
        const blockers = counts.filter((c) => c.count > 0)
        if (blockers.length > 0) {
          const summary = blockers
            .map((b) => `${b.count} ${b.count === 1 ? b.check.singular : b.check.plural}`)
            .join(', ')
          return fail(
            `This user can't be permanently deleted because they have activity history (${summary}). Keep them in the trash.`,
            409,
            'has_history',
            {
              blockers: Object.fromEntries(
                blockers.map((b) => [`${b.check.table}.${b.check.column}`, b.count]),
              ),
            },
          )
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
