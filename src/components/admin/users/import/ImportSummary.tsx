import { AlertTriangle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ResultRow, ResultSummary } from '@/lib/userImport'

interface ImportSummaryProps {
  results: readonly ResultRow[]
  summary: ResultSummary
  /** Set when a chunk could not be delivered and the import ended early. */
  haltMessage: string | null
  stoppedByUser: boolean
  onDownload: () => void
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

const KIND_LABEL: Record<string, string> = {
  failed: 'Failed',
  not_attempted: 'Not imported',
}

/**
 * The end-of-import report: created / skipped / failed counts, a table of every
 * row that did not go cleanly, and — when the server generated passwords — the
 * warning that the results file is the only place they exist.
 */
export function ImportSummary({
  results,
  summary,
  haltMessage,
  stoppedByUser,
  onDownload,
}: ImportSummaryProps) {
  const problems = results.filter(
    (r) => r.status === 'failed' || r.status === 'not_attempted' || r.warning,
  )

  return (
    <div className="space-y-4">
      <div
        className={`grid gap-3 ${summary.notAttempted > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}
        aria-label="Import results"
      >
        <Stat label="Created" value={summary.created} tone="text-teal-d" />
        <Stat label="Skipped" value={summary.skipped} tone="text-foreground" />
        <Stat label="Failed" value={summary.failed} tone="text-coral-d" />
        {summary.notAttempted > 0 ? (
          <Stat label="Not imported" value={summary.notAttempted} tone="text-muted-foreground" />
        ) : null}
      </div>

      {haltMessage ? (
        <p role="alert" className="text-coral-d text-sm">
          The import ended early. {haltMessage}
        </p>
      ) : stoppedByUser ? (
        <p className="text-muted-foreground text-sm">
          You stopped the import. Rows after the last finished batch were not imported — upload the
          same file again to continue; accounts that were created are skipped.
        </p>
      ) : null}

      {problems.length > 0 ? (
        <div className="max-h-[30vh] overflow-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground sticky top-0 text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((r) => (
                <tr key={r.line} className="border-t align-top">
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">{r.line}</td>
                  <td className="max-w-[14rem] px-3 py-2 break-all">{r.email || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.warning ? 'Needs attention' : KIND_LABEL[r.status]}
                  </td>
                  <td className="text-coral-d px-3 py-2">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Every row imported cleanly.</p>
      )}

      {summary.generatedPasswords > 0 ? (
        <div
          role="alert"
          className="border-gold bg-gold/15 flex gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertTriangle className="text-gold-d mt-0.5 size-4 shrink-0" />
          <p>
            The results file contains {summary.generatedPasswords} generated{' '}
            {summary.generatedPasswords === 1 ? 'password' : 'passwords'} — credentials that{' '}
            <strong>cannot be regenerated</strong> and are not stored anywhere else. Download it now,
            hand the passwords over securely, then delete the file.
          </p>
        </div>
      ) : null}

      <Button variant="outline" onClick={onDownload}>
        <Download />
        Download results CSV
      </Button>
    </div>
  )
}
