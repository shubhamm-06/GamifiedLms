import { cn } from '@/lib/utils'

/** unresolved = coral, matching the Dashboard's "needs attention" tone for this exact metric; resolved = teal (done). */
const STATUS_STYLES: Record<string, string> = {
  unresolved: 'bg-coral/10 text-coral-d',
  resolved: 'bg-teal/10 text-teal-d',
}

const STATUS_LABEL: Record<string, string> = {
  unresolved: 'Unresolved',
  resolved: 'Resolved',
}

export function ReconciliationStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
