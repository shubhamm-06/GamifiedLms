import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

/**
 * Device-local "last seen" timestamp for the notifications inbox (locked
 * decision: no read-tracking in the database, ever — rules.md). Stores the
 * newest `sent_at` the student has had the inbox open for, scoped per user id
 * so a shared device doesn't leak one student's "seen" state into another's
 * session. Capacitor Preferences on native, localStorage on web, behind this
 * one helper — nothing else in the app touches either storage directly.
 */

function storageKey(userId: string): string {
  return `notif_last_seen:${userId}`
}

/** Null means "never seen anything" — every notification counts as new, once. */
export async function getNotificationsLastSeen(userId: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: storageKey(userId) })
    return value
  }
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

export async function setNotificationsLastSeen(userId: string, sentAt: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: storageKey(userId), value: sentAt })
    return
  }
  try {
    localStorage.setItem(storageKey(userId), sentAt)
  } catch {
    // Best-effort: a failed write just means "new" keeps showing a little longer.
  }
}
