import { Capacitor } from '@capacitor/core'
import { WifiOff } from 'lucide-react'
import { useOnline } from '@/hooks/useOnline'

/**
 * "You're offline", shown on every kid screen while the device has no
 * connection (mounted once, in KidLayout). Native app only: the web keeps its
 * existing behaviour (the lesson player's own offline strip). Nothing is queued
 * offline; lesson actions fail with their own message and a retry.
 */
export function OfflineBanner() {
  const online = useOnline()
  if (!Capacitor.isNativePlatform() || online) return null
  return (
    <p className="kid-offline" role="status" data-testid="offline-banner">
      <WifiOff className="size-5" aria-hidden />
      You're offline. Check your Wi-Fi.
    </p>
  )
}
