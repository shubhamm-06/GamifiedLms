import { cn } from '@/lib/utils'

/**
 * draft = gold, published = teal, archived = neutral. Archived deliberately
 * uses a neutral tone rather than a fifth brand color — it means "not in
 * play", which is the absence of signal.
 */
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gold/15 text-gold-d',
  published: 'bg-teal/10 text-teal-d',
  archived: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

export function CourseStatusPill({ status }: { status: string }) {
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
