// =====================================================================
// send-push-notification — admin-only manual push send (migration 031).
//
// TODO (blocked, follow-up session): this function is written but NOT
// deployed, and cannot actually send anything yet — FCM_SERVICE_ACCOUNT_JSON
// (the Firebase service account key) has not been supplied, so
// getFcmAccessToken() throws immediately, and no SUPABASE_ACCESS_TOKEN is
// set in this environment, so there is no way to deploy it either. See
// docs/env-deploy.md "Push notifications" for the exact two commands to run
// once both pieces exist. Everything below is exercised only by reading it
// and by the admin-user-management pattern it copies; nothing here has run
// against real FCM.
//
// Same caller-verification shape as admin-user-management (schema.md "Edge
// Functions"): resolve the caller from the bearer token with the
// service-role client, then re-check `profiles.role = 'admin' AND
// deleted_at IS NULL` server-side before touching the payload — the
// client-side admin guard is UX, this is the real enforcement.
//
// `target.type`:
//   - 'all'    -> one FCM send to the "all-students" topic. FCM does not
//                 report topic subscriber counts, so recipient_count is
//                 stored as null (never guessed).
//   - 'course' -> every device_push_tokens row for a user with an active
//                 enrollment in that course, sent individually (topics
//                 cannot be scoped to a course without a *second* Google
//                 topic per course, which is out of scope here).
//   - 'user'   -> every device_push_tokens row for that one user (a
//                 student can have more than one device registered).
// Per-token sends run with bounded concurrency (mapWithConcurrency, limit
// 10); one bad/stale token is recorded as a failure and never aborts the
// rest. One notifications_sent row is written at the end either way, with
// the real recipient_count (successful sends only) — never a guess.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFcmAccessToken, mapWithConcurrency, sendFcmMessage } from '../_shared/fcm.ts'

const TOPIC = 'all-students'
const SEND_CONCURRENCY = 10
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 1000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status)
}

type Target =
  | { type: 'all' }
  | { type: 'course'; courseId: string }
  | { type: 'user'; userId: string }

type AdminClient = ReturnType<typeof createClient>

/** Maps a raw error to something safe to show an admin; logs the real detail server-side. */
function safeError(context: string, err: unknown): string {
  console.error(`[send-push-notification] ${context}:`, err)
  return 'Something went wrong sending the notification. Please try again.'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return fail('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[send-push-notification] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return fail('Server misconfigured', 500)
  }

  const admin: AdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---------------------------------------------------------------
  // 1. Resolve the caller and confirm they are a non-trashed admin.
  // ---------------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('Forbidden', 403)

  const { data: callerData, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    console.error('[send-push-notification] caller token rejected:', callerError)
    return fail('Forbidden', 403)
  }
  const callerId = callerData.user.id

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, deleted_at')
    .eq('id', callerId)
    .single()
  if (profileError || callerProfile?.role !== 'admin' || callerProfile?.deleted_at) {
    console.error(`[send-push-notification] non-admin or trashed caller ${callerId}:`, profileError ?? callerProfile)
    return fail('Forbidden', 403)
  }

  // ---------------------------------------------------------------
  // 2. Parse and validate the payload.
  // ---------------------------------------------------------------
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Invalid request body', 400)
  }

  const title = String(body.title ?? '').trim()
  const notifBody = String(body.body ?? '').trim()
  const rawTarget = body.target as Record<string, unknown> | undefined

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return fail(`Title is required and must be at most ${MAX_TITLE_LENGTH} characters`, 400)
  }
  if (!notifBody || notifBody.length > MAX_BODY_LENGTH) {
    return fail(`Body is required and must be at most ${MAX_BODY_LENGTH} characters`, 400)
  }
  if (!rawTarget || typeof rawTarget.type !== 'string') {
    return fail('A target is required', 400)
  }

  let target: Target
  if (rawTarget.type === 'all') {
    target = { type: 'all' }
  } else if (rawTarget.type === 'course') {
    const courseId = String(rawTarget.courseId ?? '')
    if (!courseId) return fail('courseId is required for a course target', 400)
    target = { type: 'course', courseId }
  } else if (rawTarget.type === 'user') {
    const userId = String(rawTarget.userId ?? '')
    if (!userId) return fail('userId is required for a user target', 400)
    target = { type: 'user', userId }
  } else {
    return fail('Unknown target type', 400)
  }

  // ---------------------------------------------------------------
  // 3. Send, then log — always log, even a zero-recipient send, so the
  //    history table reflects every attempt an admin made.
  // ---------------------------------------------------------------
  try {
    const { accessToken, projectId } = await getFcmAccessToken()
    let recipientCount: number | null = 0

    if (target.type === 'all') {
      const result = await sendFcmMessage(accessToken, projectId, { topic: TOPIC }, { title, body: notifBody })
      if (!result.ok) {
        console.error('[send-push-notification] topic send failed:', result.error)
        return fail('The notification could not be sent. Please try again.', 502)
      }
      recipientCount = null // FCM does not report topic subscriber counts
    } else {
      let tokenRows: { token: string }[] = []
      if (target.type === 'user') {
        const { data, error } = await admin.from('device_push_tokens').select('token').eq('user_id', target.userId)
        if (error) return fail(safeError('load user tokens', error), 500)
        tokenRows = data ?? []
      } else {
        const { data: enrolled, error: enrollError } = await admin
          .from('enrollments')
          .select('user_id')
          .eq('course_id', target.courseId)
          .eq('status', 'active')
        if (enrollError) return fail(safeError('load course enrollments', enrollError), 500)
        const userIds = [...new Set((enrolled ?? []).map((e) => e.user_id as string))]
        if (userIds.length > 0) {
          const { data, error } = await admin.from('device_push_tokens').select('token').in('user_id', userIds)
          if (error) return fail(safeError('load course tokens', error), 500)
          tokenRows = data ?? []
        }
      }

      const results = await mapWithConcurrency(tokenRows, SEND_CONCURRENCY, (row) =>
        sendFcmMessage(accessToken, projectId, { token: row.token }, { title, body: notifBody }),
      )
      const failures = results.filter((r) => !r.ok)
      recipientCount = results.length - failures.length
      if (failures.length > 0) {
        console.error(`[send-push-notification] ${failures.length}/${results.length} per-token sends failed`)
      }
    }

    const { error: logError } = await admin.from('notifications_sent').insert({
      sent_by: callerId,
      title,
      body: notifBody,
      target_type: target.type,
      target_course_id: target.type === 'course' ? target.courseId : null,
      target_user_id: target.type === 'user' ? target.userId : null,
      recipient_count: recipientCount,
    })
    if (logError) {
      // The send itself may have gone out; say so rather than a bare 500 that reads as "nothing happened".
      console.error('[send-push-notification] failed to log notifications_sent:', logError)
      return fail('The notification was sent, but the history log could not be saved.', 500)
    }

    return json({ success: true, recipientCount })
  } catch (err) {
    return fail(safeError('send', err), 500)
  }
})
