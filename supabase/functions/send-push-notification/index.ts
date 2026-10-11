// =====================================================================
// send-push-notification — admin-only manual push send (migration 031),
// extended into the notifications-inbox store (migration 042).
//
// Deployed 2026-09-29 (docs/changelog.md); extended 2026-10-11. Needs the
// FCM_SERVICE_ACCOUNT_JSON secret (docs/env-deploy.md "Push notifications"
// — name only, never a value) to actually push; without it getFcmAccessToken()
// throws, which is treated as a push failure, not a 500 — the row is still
// saved (see below).
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
// rest — a partial per-token failure still counts as push_sent=true,
// recipient_count is the successful-only count. push_sent is only false
// when the whole push attempt failed outright (topic send rejected, token
// fetch/auth threw) or when the caller asked to skip push (send_push=false).
//
// Insert-then-push ordering (migration 042's locked decision): the
// notifications_sent row — the inbox's source of truth — is written FIRST,
// before any FCM call. If the push then fails, the row already exists and
// is never lost; only push_sent/recipient_count get updated afterward. The
// stored row is what a student sees; push is one delivery channel on top.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFcmAccessToken, mapWithConcurrency, sendFcmMessage } from '../_shared/fcm.ts'

const TOPIC = 'all-students'
const SEND_CONCURRENCY = 10
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 1000
const MAX_DEEP_LINK_LENGTH = 200

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
  const sendPush = body.send_push === undefined ? true : Boolean(body.send_push)
  const showInInbox = body.show_in_inbox === undefined ? true : Boolean(body.show_in_inbox)
  const rawDeepLink = body.deep_link

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return fail(`Title is required and must be at most ${MAX_TITLE_LENGTH} characters`, 400)
  }
  if (!notifBody || notifBody.length > MAX_BODY_LENGTH) {
    return fail(`Body is required and must be at most ${MAX_BODY_LENGTH} characters`, 400)
  }
  if (!rawTarget || typeof rawTarget.type !== 'string') {
    return fail('A target is required', 400)
  }
  if (!sendPush && !showInInbox) {
    return fail('At least one of send_push or show_in_inbox must be true', 400)
  }
  let deepLink: string | null = null
  if (rawDeepLink !== undefined && rawDeepLink !== null && rawDeepLink !== '') {
    if (typeof rawDeepLink !== 'string' || !rawDeepLink.startsWith('/') || rawDeepLink.length > MAX_DEEP_LINK_LENGTH) {
      return fail(`deep_link must be an internal path starting with "/" of at most ${MAX_DEEP_LINK_LENGTH} characters`, 400)
    }
    deepLink = rawDeepLink
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
  // 3. Save the row FIRST — it is the inbox's source of truth, and must
  //    never be lost even if the push below fails.
  // ---------------------------------------------------------------
  const { data: inserted, error: insertError } = await admin
    .from('notifications_sent')
    .insert({
      sent_by: callerId,
      title,
      body: notifBody,
      target_type: target.type,
      target_course_id: target.type === 'course' ? target.courseId : null,
      target_user_id: target.type === 'user' ? target.userId : null,
      show_in_inbox: showInInbox,
      deep_link: deepLink,
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    return fail(safeError('save notification', insertError), 500)
  }
  const notificationId = inserted.id as string

  // ---------------------------------------------------------------
  // 4. Attempt push (if asked), then update push_sent/recipient_count.
  //    pushSent is false only for a wholesale failure (topic rejected,
  //    token/enrollment lookup or FCM auth threw) or send_push=false —
  //    never for a handful of stale per-token failures, which still
  //    count as a sent push with a smaller recipientCount.
  // ---------------------------------------------------------------
  let pushSent = false
  let recipientCount: number | null = null

  if (sendPush) {
    try {
      const { accessToken, projectId } = await getFcmAccessToken()
      const data: Record<string, string> = { notificationId }
      if (deepLink) data.deepLink = deepLink

      if (target.type === 'all') {
        const result = await sendFcmMessage(accessToken, projectId, { topic: TOPIC }, { title, body: notifBody }, data)
        pushSent = result.ok
        recipientCount = null // FCM does not report topic subscriber counts
        if (!result.ok) console.error('[send-push-notification] topic send failed:', result.error)
      } else {
        let tokenRows: { token: string }[] = []
        if (target.type === 'user') {
          const { data: rows, error } = await admin.from('device_push_tokens').select('token').eq('user_id', target.userId)
          if (error) throw error
          tokenRows = rows ?? []
        } else {
          const { data: enrolled, error: enrollError } = await admin
            .from('enrollments')
            .select('user_id')
            .eq('course_id', target.courseId)
            .eq('status', 'active')
          if (enrollError) throw enrollError
          const userIds = [...new Set((enrolled ?? []).map((e) => e.user_id as string))]
          if (userIds.length > 0) {
            const { data: rows, error } = await admin.from('device_push_tokens').select('token').in('user_id', userIds)
            if (error) throw error
            tokenRows = rows ?? []
          }
        }

        const results = await mapWithConcurrency(tokenRows, SEND_CONCURRENCY, (row) =>
          sendFcmMessage(accessToken, projectId, { token: row.token }, { title, body: notifBody }, data),
        )
        const failures = results.filter((r) => !r.ok)
        recipientCount = results.length - failures.length
        pushSent = true
        if (failures.length > 0) {
          console.error(`[send-push-notification] ${failures.length}/${results.length} per-token sends failed`)
        }
      }
    } catch (err) {
      console.error(safeError('send', err))
      pushSent = false
      recipientCount = null
    }
  }

  const { error: updateError } = await admin
    .from('notifications_sent')
    .update({ push_sent: pushSent, recipient_count: recipientCount })
    .eq('id', notificationId)
  if (updateError) {
    console.error('[send-push-notification] failed to update push_sent/recipient_count:', updateError)
  }

  if (sendPush && !pushSent) {
    return json({
      success: true,
      id: notificationId,
      recipientCount,
      pushSent: false,
      warning: 'The notification was saved, but the push could not be sent.',
    })
  }

  return json({ success: true, id: notificationId, recipientCount, pushSent })
})
