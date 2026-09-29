import { Capacitor } from '@capacitor/core'
import { PushNotifications, type PermissionStatus } from '@capacitor/push-notifications'
import { supabase } from './supabase'

/**
 * Manual push notifications (Android only), sent by an admin via FCM
 * (migration 031, `send-push-notification`). Everything here is native only
 * (`Capacitor.isNativePlatform()`); on the web this whole module is a no-op —
 * no permission prompt, no plugin call, nothing written anywhere.
 *
 * Registration flow, called once per app session from `KidLayout` (covers
 * both "just logged in" and "app started with an existing session", since
 * that layout mounts whenever a signed-in student is on a kid route):
 *   1. Request the runtime notification permission (Android 13+ only; 12 and
 *      below report `granted` without a prompt, per the plugin's own docs).
 *   2. `register()` and wait for the `registration` event's FCM token.
 *   3. Upsert it into `device_push_tokens` directly (ordinary RLS-scoped
 *      write — ON CONFLICT (token), so a device that already has a row just
 *      gets its `user_id` reassigned to whoever is signed in on it now).
 *   4. Subscribe that token to the "all-students" topic via the
 *      `register-push-token` Edge Function. This step needs a server call
 *      because the plugin exposes no client-side `subscribeToTopic` (checked
 *      against 8.1.2's shipped types — there isn't one), and topic
 *      subscription is only possible through FCM's server-side Instance ID
 *      API, which needs the service account's OAuth token.
 * Every step is best-effort: a failure here must never block sign-in or
 * surface as an error the student sees.
 */

const TOKEN_STORAGE_KEY = 'push.lastToken'

let registering: Promise<void> | null = null

function isPromptable(state: PermissionStatus['receive']): boolean {
  return state === 'prompt' || state === 'prompt-with-rationale'
}

/** Idempotent within one app session: a second call while the first is still running joins it instead of registering twice. */
export function registerPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (registering) return registering
  registering = doRegister().finally(() => {
    registering = null
  })
  return registering
}

async function doRegister(): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    const current = await PushNotifications.checkPermissions()
    const state = isPromptable(current.receive) ? (await PushNotifications.requestPermissions()).receive : current.receive
    if (state !== 'granted') return

    const token = await new Promise<string | null>((resolve) => {
      let settled = false
      const finish = (value: string | null) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      // Both listeners must be attached before register() is called, or the event can fire unheard.
      void PushNotifications.addListener('registration', (t) => finish(t.value))
      void PushNotifications.addListener('registrationError', () => finish(null))
      void PushNotifications.register()
      // A device that never answers (no Play Services, no network) must not hang registration forever.
      setTimeout(() => finish(null), 10_000)
    })
    if (!token) return

    localStorage.setItem(TOKEN_STORAGE_KEY, token)

    const { error: upsertError } = await supabase
      .from('device_push_tokens')
      .upsert({ user_id: session.user.id, token, platform: 'android' }, { onConflict: 'token' })
    if (upsertError) {
      console.error('[pushNotifications] token upsert failed:', upsertError)
      return
    }

    await supabase.functions.invoke('register-push-token', { body: { token } })
  } catch (err) {
    // Best-effort: push registration must never surface to the student or block anything else.
    console.error('[pushNotifications] registration failed:', err)
  }
}

/**
 * Best-effort removal of this device's token on logout, so a signed-out
 * device stops receiving pushes for the account that just left it. Never
 * throws and never blocks the caller (logout proceeds either way).
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) return
    await supabase.from('device_push_tokens').delete().eq('token', token)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch (err) {
    console.error('[pushNotifications] token cleanup failed:', err)
  }
}

/**
 * A tapped notification (app was backgrounded or fully killed): opens to
 * whatever screen was already showing when it resumes. No deep-linking to a
 * specific lesson/screen in this pass (spec, section 3) — this listener only
 * has to exist so a tap never crashes or leaves the app on a blank screen.
 */
export function listenForNotificationTaps(): void {
  if (!Capacitor.isNativePlatform()) return
  void PushNotifications.addListener('pushNotificationActionPerformed', () => {
    // Intentionally a no-op beyond logging: the OS already brings the app to
    // the foreground on its own activity stack, landing wherever it was.
    console.info('[pushNotifications] notification tapped')
  })
}
