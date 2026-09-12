import { cn } from '@/lib/utils'

/** active = teal (in-play), expired/revoked both read as "no longer in play". */
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-teal/10 text-teal-d',
  expired: 'bg-muted text-muted-foreground',
  revoked: 'bg-coral/10 text-coral-d',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
}

export function EnrollmentStatusPill({ status }: { status: string }) {
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
