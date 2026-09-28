import { useCallback, useState } from 'react'
import { HAPTICS_STORAGE_KEY, readHapticsEnabled } from '@/lib/haptics'

/**
 * Whether kid-app haptics are on. Same pattern as `useSoundEffects`: this
 * device's localStorage (`kid.hapticsEnabled`), default on, no profiles column
 * (a per-device preference). `lib/haptics.ts` reads the same key on every
 * haptic, so a change applies at once.
 */
export function useHapticsSetting() {
  const [enabled, setEnabledState] = useState(readHapticsEnabled)

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next)
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, String(next))
    } catch {
      // Private browsing / blocked storage: works for this session, just doesn't persist.
    }
  }, [])

  return [enabled, setEnabled] as const
}
