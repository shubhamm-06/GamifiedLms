import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  importManualOrders,
  useInvalidateAfterImport,
  type ImportOrderRow,
  type ImportOrdersResult,
} from '@/hooks/admin/usePayments'
import { downloadTextFile, parseCsv, stringifyCsv } from '@/lib/csv'

const REQUIRED_COLUMNS = ['email', 'course_slug', 'amount', 'currency', 'provider'] as const
const OPTIONAL_COLUMNS = ['note'] as const

const TEMPLATE_CSV = stringifyCsv([
  [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
  ['student@example.com', 'example-course-slug', '999', 'INR', 'bank_transfer', 'Paid via NEFT'],
])

function downloadTemplate() {
  downloadTextFile('manual-orders-template.csv', TEMPLATE_CSV)
}

/** Maps a header row to column indexes, so column order in the file doesn't matter. */
function resolveColumns(header: string[]): { indexes: Record<string, number>; missing: string[] } {
  const normalised = header.map((h) => h.trim().toLowerCase())
  const indexes: Record<string, number> = {}
  const missing: string[] = []

  for (const col of REQUIRED_COLUMNS) {
    const idx = normalised.indexOf(col)
    if (idx === -1) missing.push(col)
    else indexes[col] = idx
  }
  for (const col of OPTIONAL_COLUMNS) {
    const idx = normalised.indexOf(col)
    if (idx !== -1) indexes[col] = idx
  }
  return { indexes, missing }
}

function rowsFromCsvText(text: string): { rows: ImportOrderRow[]; error: string | null } {
  const parsed = parseCsv(text).filter((r) => !(r.length === 1 && r[0].trim() === ''))
  if (parsed.length === 0) return { rows: [], error: 'The file is empty.' }

  const [header, ...dataRows] = parsed
  const { indexes, missing } = resolveColumns(header)
  if (missing.length > 0) {
    return { rows: [], error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` }
  }

  const rows: ImportOrderRow[] = dataRows.map((cells) => ({
    email: cells[indexes.email] ?? '',
    courseSlug: cells[indexes.course_slug] ?? '',
    amount: cells[indexes.amount] ?? '',
    currency: cells[indexes.currency] ?? '',
    provider: cells[indexes.provider] ?? '',
    note: indexes.note !== undefined ? (cells[indexes.note] ?? '') : '',
  }))

  return { rows, error: null }
}

interface ImportOrdersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Mounts fresh per open, so a previous file/result never carries into the next import. */
function ImportOrdersForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidateAfterImport()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportOrderRow[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportOrdersResult | null>(null)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const { rows: parsedRows, error } = rowsFromCsvText(text)
      if (error) {
        setParseError(error)
        setRows(null)
      } else {
        setParseError(null)
        setRows(parsedRows)
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return
    setIsImporting(true)
    try {
      const importResult = await importManualOrders(rows)
      setResult(importResult)
      // Once for the whole batch, not once per row.
      invalidate()
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsImporting(false)
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          <span className="font-medium">{result.succeededCount}</span> succeeded,{' '}
          <span className="font-medium">{result.failedCount}</span> failed, of {result.results.length}{' '}
          rows.
        </p>
        {result.failedCount > 0 ? (
          <div className="max-h-56 overflow-y-auto rounded-md border">
            <ul className="divide-y">
              {result.results
                .filter((r) => !r.success)
                .map((r) => (
                  <li key={r.row} className="px-3 py-2 text-sm">
                    <span className="font-medium">Row {r.row}</span>{' '}
                    <span className="text-muted-foreground">({r.email || 'no email'})</span>
                    <p className="text-coral-d">{r.error}</p>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={downloadTemplate}>
        <Download />
        Download template
      </Button>

      <div className="space-y-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" variant="outline" onClick={handlePickFile} disabled={isImporting}>
          <Upload />
          {fileName ?? 'Choose CSV file…'}
        </Button>
        {parseError ? <p className="text-coral-d text-sm">{parseError}</p> : null}
        {rows && !parseError ? (
          <p className="text-muted-foreground text-sm">
            Ready to import {rows.length} row{rows.length === 1 ? '' : 's'}.
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!rows || rows.length === 0 || !!parseError || isImporting}
          onClick={handleImport}
        >
          {isImporting ? 'Importing…' : `Import${rows ? ` ${rows.length} rows` : ''}`}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ImportOrdersDialog({ open, onOpenChange }: ImportOrdersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import orders</DialogTitle>
          <DialogDescription>
            Bulk-creates orders the same way Add Order does, one row at a time. A bad row (unknown
            email, unknown course slug, an existing enrollment) fails on its own — it won&rsquo;t
            block the rows around it.
          </DialogDescription>
        </DialogHeader>
        {/* No key needed: Radix unmounts DialogContent's children on close,
            so this mounts fresh every time regardless. */}
        <ImportOrdersForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
