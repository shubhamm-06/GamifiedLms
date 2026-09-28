import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Kid-facing haptics, a thin wrapper over `@capacitor/haptics`. Every function
 * is a silent no-op on the web, when the child turned haptics off on Profile,
 * and when the plugin throws: a haptic can never break the UI.
 *
 * One haptic per event, never stacked: a second haptic within
 * `COALESCE_MS` of the previous one is dropped, so moments that coincide (a
 * quiz pass that opens the completion celebration, an XP award shown on that
 * same sheet) produce a single buzz. Never call these from admin screens.
 */

/** Same storage pattern as the sound-effects toggle (`useSoundEffects`): this device's localStorage, default on. */
export const HAPTICS_STORAGE_KEY = 'kid.hapticsEnabled'

const COALESCE_MS = 400
let last = 0

export function readHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function fire(run: () => Promise<void>) {
  if (!Capacitor.isNativePlatform() || !readHapticsEnabled()) return
  const now = Date.now()
  if (now - last < COALESCE_MS) return
  last = now
  try {
    void run().catch(() => {})
  } catch {
    // Plugin missing or failing: haptics are decoration, never an error.
  }
}

/** A light tap: bottom-nav tabs, lesson nodes, an XP award on its own. */
export const tap = () => fire(() => Haptics.impact({ style: ImpactStyle.Light }))
/** A selection tick: the Profile toggles. */
export const select = () => fire(() => Haptics.selectionChanged())
export const success = () => fire(() => Haptics.notification({ type: NotificationType.Success }))
export const warning = () => fire(() => Haptics.notification({ type: NotificationType.Warning }))
export const error = () => fire(() => Haptics.notification({ type: NotificationType.Error }))
