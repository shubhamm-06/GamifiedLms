import { WifiOff } from 'lucide-react'
import type { ClockPause } from '@/hooks/useLessonClock'
import { playerCopy } from '@/lib/playerCopy'

/**
 * A slim, non-blocking strip for the two pauses that need a sentence:
 * offline and reconnecting (spec Part A7). A hidden tab or app, and the quiet
 * period right after coming back, are shown by the time ring alone (dimmed,
 * spec Part B2) and resume silently, with no banner and no modal.
 */
export function PausedNotice({ reason }: { reason: ClockPause | null }) {
  if (reason !== 'offline' && reason !== 'connection') return null
  return (
    <p className="lp-offline-banner" role="status" data-testid="paused-notice" data-reason={reason}>
      <WifiOff className="size-5 flex-none" aria-hidden />
      {reason === 'offline' ? playerCopy.offline : playerCopy.reconnecting}
    </p>
  )
}
