import { cn } from '@/lib/utils'

/** paid = teal (good), refunded = neutral (money returned, not a failure), failed = coral (bad). */
const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-teal/10 text-teal-d',
  refunded: 'bg-muted text-muted-foreground',
  failed: 'bg-coral/10 text-coral-d',
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
}

export function PaymentStatusPill({ status }: { status: string }) {
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
