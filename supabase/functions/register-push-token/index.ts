// =====================================================================
// register-push-token — subscribes one device's FCM token to the
// "all-students" topic (migration 031).
//
// Deployed 2026-09-29 (docs/changelog.md), same FCM_SERVICE_ACCOUNT_JSON
// secret as send-push-notification (docs/env-deploy.md "Push notifications").
//
// Why this function exists at all: @capacitor/push-notifications 8.1.2 has
// no client-side subscribeToTopic/unsubscribeFromTopic (checked against its
// shipped .d.ts — register/unregister/checkPermissions/requestPermissions/
// addListener/removeAllListeners/channel management, nothing topic-shaped).
// Subscribing a token to a topic is only possible through FCM's server-side
// Instance ID API, which needs the service account's OAuth token — so it
// has to happen here, not in the client. The client does its own
// device_push_tokens upsert directly (ordinary RLS-scoped insert, no
// function needed for that part) and calls this function only for the
// topic subscription step, right after.
//
// Any signed-in, non-trashed user may call this (not admin-only — every
// student registering their own device needs to). The only real check is
// that the token being subscribed is one this caller actually owns in
// device_push_tokens, so an arbitrary string can't be handed to FCM's API
// through this endpoint.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFcmAccessToken, subscribeTokenToTopic } from '../_shared/fcm.ts'

const TOPIC = 'all-students'

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return fail('Method not allowed', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[register-push-token] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return fail('Server misconfigured', 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Any signed-in, non-trashed user — this is self-service, not admin-only.
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearer) return fail('Forbidden', 403)

  const { data: callerData, error: callerError } = await admin.auth.getUser(bearer)
  if (callerError || !callerData?.user) {
    console.error('[register-push-token] caller token rejected:', callerError)
    return fail('Forbidden', 403)
  }
  const callerId = callerData.user.id

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('deleted_at')
    .eq('id', callerId)
    .single()
  if (profileError || callerProfile?.deleted_at) {
    console.error(`[register-push-token] trashed or unknown caller ${callerId}:`, profileError ?? callerProfile)
    return fail('Forbidden', 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return fail('Invalid request body', 400)
  }
  const token = String(payload.token ?? '').trim()
  if (!token) return fail('token is required', 400)

  // Defense against an arbitrary string being handed to FCM's API: the
  // token must already be this caller's own row (the client upserts it
  // before calling here).
  const { data: owned, error: ownedError } = await admin
    .from('device_push_tokens')
    .select('id')
    .eq('user_id', callerId)
    .eq('token', token)
    .maybeSingle()
  if (ownedError) {
    console.error('[register-push-token] ownership check failed:', ownedError)
    return fail('Something went wrong. Please try again.', 500)
  }
  if (!owned) return fail('This token is not registered to your account', 403)

  try {
    const { accessToken } = await getFcmAccessToken()
    const result = await subscribeTokenToTopic(accessToken, token, TOPIC)
    if (!result.ok) {
      console.error('[register-push-token] topic subscribe failed:', result.error)
      return fail('Could not subscribe this device to notifications.', 502)
    }
    return json({ success: true })
  } catch (err) {
    console.error('[register-push-token] error:', err)
    return fail('Something went wrong. Please try again.', 500)
  }
})
