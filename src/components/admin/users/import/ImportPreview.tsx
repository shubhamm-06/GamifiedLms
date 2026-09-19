import { Badge } from '@/components/ui/badge'
import type { ImportRow, PreviewStatus } from '@/lib/userImport'

const STATUS_LABEL: Record<PreviewStatus, string> = {
  valid: 'Valid',
  error: 'Error',
  exists: 'Skipped',
  trashed: 'Error',
}

const STATUS_STYLE: Record<PreviewStatus, string> = {
  valid: 'bg-teal/10 text-teal-d',
  error: 'bg-coral/10 text-coral-d',
  exists: 'bg-gold/20 text-gold-d',
  trashed: 'bg-coral/10 text-coral-d',
}

/**
 * One line per file row with its verdict. The password column only ever says
 * whether one was supplied — the value is never rendered.
 */
export function ImportPreview({ rows }: { rows: readonly ImportRow[] }) {
  return (
    <div className="max-h-[38vh] overflow-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground sticky top-0 text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Row</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Password</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line} className="border-t align-top" data-status={row.status}>
              <td className="text-muted-foreground px-3 py-2 tabular-nums">{row.line}</td>
              <td className="max-w-[10rem] px-3 py-2 break-words whitespace-pre-line">{row.displayName}</td>
              <td className="max-w-[12rem] px-3 py-2 break-all">{row.email}</td>
              <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">{row.phone || '—'}</td>
              <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                {row.password ? 'Provided' : 'Auto-generate'}
              </td>
              <td className="px-3 py-2">
                <Badge className={`border-transparent font-medium ${STATUS_STYLE[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </Badge>
                {row.reasons.length > 0 ? (
                  <p
                    className={
                      row.status === 'exists'
                        ? 'text-muted-foreground mt-1 text-xs'
                        : 'text-coral-d mt-1 text-xs'
                    }
                  >
                    {row.reasons.join('; ')}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
