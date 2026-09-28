import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

/**
 * Whether the device has a connection. The one shared online/offline source for
 * UI. Native: `@capacitor/network` (the OS's own answer, more reliable than
 * `navigator.onLine` inside a WebView). Web: `navigator.onLine` and its events.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let cancelled = false
      void Network.getStatus().then((s) => {
        if (!cancelled) setOnline(s.connected)
      })
      const handle = Network.addListener('networkStatusChange', (s) => setOnline(s.connected))
      return () => {
        cancelled = true
        void handle.then((h) => h.remove())
      }
    }
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
