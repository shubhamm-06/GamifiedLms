// =====================================================================
// _shared/fcm.ts — Firebase Cloud Messaging, shared by send-push-notification
// and register-push-token. Deployed 2026-09-29 (docs/changelog.md) alongside
// both; the FCM_SERVICE_ACCOUNT_JSON secret it reads is set in the same
// project (docs/env-deploy.md "Push notifications" — name only, no value).
//
// The service account's own JWT-bearer OAuth2 flow (RFC 7523): no refresh
// token, no interactive consent, no library beyond `jose` for RS256 signing
// (an npm import, as Supabase Edge Functions/Deno support `npm:` specifiers)
// — exactly what a server-to-server credential is for. The access token is
// cached in memory for the life of this function instance and is never
// returned to a caller; only this module ever sees it or the private key.
// =====================================================================
import { SignJWT, importPKCS8 } from 'npm:jose@5'

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
  token_uri?: string
}

interface CachedToken {
  token: string
  expiresAt: number
}

let cached: CachedToken | null = null

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!raw) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON secret is not set')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
  const sa = parsed as Partial<ServiceAccount>
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is missing client_email, private_key or project_id')
  }
  return sa as ServiceAccount
}

/**
 * A short-lived (1 hour) OAuth2 access token scoped to Firebase Messaging,
 * from the service account's own credentials. Refreshed a minute before
 * expiry; reused across calls within the same function instance otherwise.
 */
export async function getFcmAccessToken(): Promise<{ accessToken: string; projectId: string }> {
  const sa = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.expiresAt - 60 > now) {
    return { accessToken: cached.token, projectId: sa.project_id }
  }

  const key = await importPKCS8(sa.private_key, 'RS256')
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token'
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`FCM OAuth token request failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const body = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: body.access_token, expiresAt: now + body.expires_in }
  return { accessToken: body.access_token, projectId: sa.project_id }
}

export interface FcmResult {
  ok: boolean
  /** Truncated response body on failure; never thrown, so one bad token never aborts a batch. */
  error?: string
}

// The status-bar icon (android/app/src/main/res/drawable-*/ic_stat_notify.png, a
// monochrome silhouette derived from the owl mark's own shape geometry — Android
// requires a white-on-transparent silhouette here; a full-color icon is ignored or
// shown as a plain dot) and the locked --gold token (src/styles.css) for its tint.
// Set explicitly on every send rather than relying solely on the manifest's
// `default_notification_icon` meta-data, which is only a fallback for a message
// that omits these fields.
const NOTIFICATION_ICON = 'ic_stat_notify'
const NOTIFICATION_COLOR = '#F2B233'

/** FCM HTTP v1 send: either `{ topic }` or `{ token }` must be set on `target`. */
export async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  target: { topic: string } | { token: string },
  notification: { title: string; body: string },
): Promise<FcmResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        ...target,
        notification,
        android: { notification: { icon: NOTIFICATION_ICON, color: NOTIFICATION_COLOR } },
      },
    }),
  })
  if (res.ok) return { ok: true }
  const text = await res.text()
  return { ok: false, error: text.slice(0, 300) }
}

/**
 * FCM's legacy Instance ID API: the only server-side way to subscribe an
 * already-issued registration token to a topic. There is no HTTP v1
 * equivalent — Google has not replaced this endpoint.
 */
export async function subscribeTokenToTopic(accessToken: string, token: string, topic: string): Promise<FcmResult> {
  const res = await fetch(
    `https://iid.googleapis.com/iid/v1/${encodeURIComponent(token)}/rel/topics/${encodeURIComponent(topic)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  )
  if (res.ok) return { ok: true }
  const text = await res.text()
  return { ok: false, error: text.slice(0, 300) }
}

/** Runs `fn` over `items` with at most `limit` in flight at once. Never throws on an individual failure. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
