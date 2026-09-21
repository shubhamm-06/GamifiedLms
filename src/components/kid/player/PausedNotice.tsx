import { Hourglass, Pause, WifiOff } from 'lucide-react'
import type { ClockPause } from '@/hooks/useLessonClock'

const COPY: Record<ClockPause, { text: string; Icon: typeof Pause }> = {
  hidden: { text: 'Paused. Come back to this screen to keep the timer going.', Icon: Pause },
  offline: { text: "You're offline. The timer is paused until you're back online.", Icon: WifiOff },
  resuming: { text: 'Welcome back! The timer is getting ready.', Icon: Hourglass },
  connection: { text: "We can't reach the server right now. We'll keep trying.", Icon: WifiOff },
}

/** A calm strip saying why the timer is not counting. Icon plus words, never colour alone. */
export function PausedNotice({ reason }: { reason: ClockPause | null }) {
  if (!reason) return null
  const { text, Icon } = COPY[reason]
  return (
    <p className="lp-notice" role="status" data-testid="paused-notice" data-reason={reason}>
      <Icon className="size-5 flex-none" aria-hidden />
      {text}
    </p>
  )
}
