import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useImportUsers } from '@/hooks/admin/useImportUsers'
import { fetchAccountStates } from '@/hooks/admin/useUsers'
import { download, localDateStamp } from '@/lib/csv'
import {
  buildResultRows,
  checkImportFile,
  countPreview,
  IMPORT_COLUMNS,
  markExistingAccounts,
  parseUserImport,
  resultsToCsv,
  summarizeResults,
  userImportTemplateCsv,
  type ImportRow,
} from '@/lib/userImport'
import { ImportDropZone } from './ImportDropZone'
import { ImportPreview } from './ImportPreview'
import { ImportSummary } from './ImportSummary'

interface PreviewData {
  fileName: string
  rows: ImportRow[]
  ignoredColumns: string[]
  encodingIssue: boolean
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="border-gold bg-gold/15 flex gap-2 rounded-lg border px-3 py-2 text-sm">
      <AlertTriangle className="text-gold-d mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function downloadTemplate() {
  download('skillxp-users-template.csv', userImportTemplateCsv())
}

interface ImportUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * CSV import for student accounts: pick a file → preview with per-row verdicts →
 * import in chunks with progress and Stop → summary with a results file.
 *
 * It cannot be closed while an import is running. Everything it holds — parsed
 * rows and any generated passwords — is dropped shortly after it closes, so a
 * closed dialog keeps no credentials in memory.
 */
export function ImportUsersDialog({ open, onOpenChange }: ImportUsersDialogProps) {
  const runner = useImportUsers()
  const [stage, setStage] = useState<'select' | 'checking' | 'preview'>('select')
  const [fileError, setFileError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const view = runner.phase === 'idle' ? stage : runner.phase
  const running = runner.phase === 'running'
  const busy = running || stage === 'checking'

  const counts = useMemo(() => (preview ? countPreview(preview.rows) : null), [preview])
  const results = useMemo(
    () => (preview && runner.phase === 'done' ? buildResultRows(preview.rows, runner.outcomes) : []),
    [preview, runner.phase, runner.outcomes],
  )
  const summary = useMemo(() => summarizeResults(results), [results])

  async function handleFile(file: File) {
    setFileError(null)
    const problem = checkImportFile(file)
    if (problem) {
      setFileError(problem)
      return
    }

    setStage('checking')
    try {
      const parsed = parseUserImport(await file.text())
      if (!parsed.ok) {
        setFileError(parsed.error)
        setStage('select')
        return
      }
      // The list never shows trashed users, so ask the database, not the cache.
      const accounts = await fetchAccountStates()
      setPreview({
        fileName: file.name,
        rows: markExistingAccounts(parsed.rows, accounts),
        ignoredColumns: parsed.ignoredColumns,
        encodingIssue: parsed.encodingIssue,
      })
      setStage('preview')
    } catch {
      setFileError("Couldn't read that file. Please try again.")
      setStage('select')
    }
  }

  function clearAll() {
    runner.reset()
    setStage('select')
    setFileError(null)
    setPreview(null)
    setDownloaded(false)
    setConfirmClose(false)
  }

  function close() {
    onOpenChange(false)
    // After the fade-out, so the dialog doesn't visibly jump back to step one.
    window.setTimeout(clearAll, 300)
  }

  function requestClose() {
    if (busy) return
    // Generated passwords exist only in this dialog: don't let them vanish unseen.
    if (runner.phase === 'done' && summary.generatedPasswords > 0 && !downloaded && !confirmClose) {
      setConfirmClose(true)
      return
    }
    close()
  }

  function downloadResults() {
    download(`skillxp-import-results-${localDateStamp()}.csv`, resultsToCsv(results))
    setDownloaded(true)
    setConfirmClose(false)
  }

  function startImport() {
    if (!preview) return
    void runner.start(preview.rows.filter((r) => r.status === 'valid'))
  }

  const progress = runner.progress
  const percent = progress ? Math.round((progress.rowsDone / progress.rowsTotal) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent
        className="sm:max-w-3xl"
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import users</DialogTitle>
          <DialogDescription>
            Create student accounts from a CSV file. Accounts that already exist are skipped, never
            changed.
          </DialogDescription>
        </DialogHeader>

        {view === 'select' ? (
          <div className="space-y-4">
            <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
              <span>
                Columns: <code>{IMPORT_COLUMNS.join(', ')}</code>. Leave <code>password</code> blank to
                generate one.
              </span>
              <Button variant="link" size="sm" onClick={downloadTemplate}>
                Download template
              </Button>
            </div>
            <ImportDropZone onFile={(f) => void handleFile(f)} error={fileError} />
          </div>
        ) : null}

        {view === 'checking' ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Reading the file and checking existing accounts…
          </div>
        ) : null}

        {view === 'preview' && preview && counts ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{preview.fileName}</span>
              <span className="text-muted-foreground">
                {' '}
                — {counts.total} {counts.total === 1 ? 'row' : 'rows'}: {counts.valid} valid
                {counts.exists > 0 ? `, ${counts.exists} already exist` : ''}
                {counts.trashed > 0 ? `, ${counts.trashed} in trash` : ''}
                {counts.errors > 0 ? `, ${counts.errors} with errors` : ''}
              </span>
            </p>
            {preview.ignoredColumns.length > 0 ? (
              <Notice>
                Ignored {preview.ignoredColumns.length === 1 ? 'column' : 'columns'}:{' '}
                <strong>{preview.ignoredColumns.join(', ')}</strong>. Only {IMPORT_COLUMNS.join(', ')}{' '}
                are imported, and every imported account is a student.
              </Notice>
            ) : null}
            {preview.encodingIssue ? (
              <Notice>
                Some characters look garbled, so this file may not be saved as UTF-8. Re-save it as
                &ldquo;CSV UTF-8&rdquo; if names look wrong below.
              </Notice>
            ) : null}
            <ImportPreview rows={preview.rows} />
          </div>
        ) : null}

        {view === 'running' ? (
          <div className="space-y-3 py-4" aria-live="polite">
            <Progress value={percent} aria-label="Import progress" />
            <p className="text-sm">
              {progress
                ? `Batch ${progress.chunk} of ${progress.chunkCount} — ${progress.rowsDone} of ${progress.rowsTotal} rows done`
                : 'Starting…'}
              {progress?.retrying ? (
                <span className="text-muted-foreground"> · connection problem, retrying…</span>
              ) : null}
            </p>
            <p className="text-muted-foreground text-xs">
              {runner.stopping
                ? 'Stopping after this batch finishes…'
                : 'Keep this window open until the import finishes.'}
            </p>
          </div>
        ) : null}

        {view === 'done' ? (
          <ImportSummary
            results={results}
            summary={summary}
            haltMessage={runner.haltMessage}
            stoppedByUser={runner.stoppedByUser}
            onDownload={downloadResults}
          />
        ) : null}

        {confirmClose ? (
          <Notice>
            You haven&rsquo;t downloaded the results file. The generated passwords exist only here and
            will be lost if you close.
          </Notice>
        ) : null}

        <DialogFooter>
          {view === 'preview' && counts ? (
            <>
              <Button variant="ghost" onClick={() => setStage('select')}>
                Choose a different file
              </Button>
              <Button variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button disabled={counts.valid === 0} onClick={startImport}>
                Import {counts.valid} valid {counts.valid === 1 ? 'row' : 'rows'}
              </Button>
            </>
          ) : null}
          {view === 'running' ? (
            <Button variant="outline" disabled={runner.stopping} onClick={runner.stop}>
              {runner.stopping ? 'Stopping…' : 'Stop'}
            </Button>
          ) : null}
          {view === 'done' ? (
            confirmClose ? (
              <>
                <Button variant="outline" onClick={downloadResults}>
                  Download results CSV
                </Button>
                <Button variant="outline" onClick={close}>
                  Close anyway
                </Button>
              </>
            ) : (
              <Button onClick={requestClose}>Close</Button>
            )
          ) : null}
          {view === 'select' || view === 'checking' ? (
            <Button variant="outline" disabled={busy} onClick={requestClose}>
              Cancel
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
