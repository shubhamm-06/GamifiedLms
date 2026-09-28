import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { KeepAwake } from '@capacitor-community/keep-awake'

/**
 * Keeps the screen on while `active` (a video that is playing, a game that is
 * on screen). Released when `active` turns false, on unmount and whenever the
 * app goes to the background; taken again on return if still active. Native
 * only: a no-op on the web. Failures are ignored, the screen just may dim.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return
    const hold = () => void KeepAwake.keepAwake().catch(() => {})
    const release = () => void KeepAwake.allowSleep().catch(() => {})
    hold()
    const handle = App.addListener('appStateChange', ({ isActive }) => (isActive ? hold() : release()))
    return () => {
      void handle.then((h) => h.remove())
      release()
    }
  }, [active])
}
