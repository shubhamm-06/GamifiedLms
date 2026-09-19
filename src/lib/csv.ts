/**
 * CSV read/write, in two layers.
 *
 * Generic layer (new code uses this): `toCsv` + `download` for writing
 * (RFC 4180 quoting, CRLF, UTF-8 BOM, formula-injection guard) and
 * `parseCsvTable` for reading (papaparse: delimiter auto-detect, BOM strip).
 *
 * Legacy layer — `parseCsv`, `stringifyCsv`, `downloadTextFile` — is the
 * original hand-written comma-only helper set that the Orders export/import
 * still uses. It has no BOM and no injection guard; it is left alone because
 * payments are out of scope for the Users CSV work (see `docs/state.md`).
 */
import Papa from 'papaparse'

// ---------------------------------------------------------------------------
// Generic layer
// ---------------------------------------------------------------------------

export interface CsvColumn<T> {
  /** Header cell text. */
  header: string
  /** Cell value for a row. `null`/`undefined` become an empty cell. */
  value: (row: T) => string | number | null | undefined
}

/** First characters a spreadsheet treats as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/

/**
 * Renders one cell: guards against formula injection, then applies RFC 4180
 * quoting. A string starting with `= + - @ TAB CR` gets a single leading `'`
 * so Excel/Sheets show it as text instead of evaluating it. Real numbers are
 * exempt (a negative number is not an attack, and prefixing would corrupt it).
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'number' ? String(value) : value
  if (typeof value === 'string' && FORMULA_LEAD.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Undoes the guard `escapeCsvCell` adds, so an exported file re-imports to the
 * original text: `'=1+1` → `=1+1`. Only strips an apostrophe that sits directly
 * in front of a formula-lead character, so an ordinary leading apostrophe
 * (`'Ana`) is untouched.
 */
export function stripFormulaGuard(text: string): string {
  return /^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text
}

/** Serialises rows to CSV text: header row first, CRLF line endings, no BOM (`download` adds it). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

/**
 * Saves CSV text as a file. Prepends a UTF-8 BOM so Excel detects the encoding
 * instead of reading accented/Indic characters as Windows-1252.
 */
export function download(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export interface ParsedCsvTable {
  /** First non-empty row, raw (untrimmed, original case). */
  header: string[]
  /** Remaining non-empty rows; each may be shorter or longer than `header`. */
  rows: string[][]
  /** Delimiter papaparse settled on. */
  delimiter: string
  /** Set when the file is structurally broken (e.g. an unclosed quote). */
  fatalError: string | null
}

/**
 * Parses CSV text into a header row and data rows. Strips a BOM, auto-detects
 * the delimiter (comma, tab, semicolon, pipe) and skips blank lines. It does
 * not interpret the header — matching columns is the caller's job.
 */
export function parseCsvTable(text: string): ParsedCsvTable {
  const clean = text.replace(/^\uFEFF/, '')
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' })

  // "UndetectableDelimiter" is expected for a one-column file; papaparse falls
  // back to a comma and the parse is still correct.
  const broken = result.errors.find((e) => e.type === 'Quotes')
  const [header = [], ...rows] = result.data
  return {
    header,
    rows,
    delimiter: result.meta.delimiter,
    fatalError: broken
      ? 'The file has an unclosed quote. Check for a stray " character.'
      : null,
  }
}

// ---------------------------------------------------------------------------
// Legacy layer (Orders)
// ---------------------------------------------------------------------------

/** Parses CSV text into rows of raw string cells. Handles quoted fields containing commas, quotes (`""`), and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let sawAnyContent = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }

    if (char === '"') {
      inQuotes = true
      sawAnyContent = true
      i++
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      sawAnyContent = true
      i++
      continue
    }
    if (char === '\r') {
      i++
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      sawAnyContent = false
      i++
      continue
    }
    field += char
    sawAnyContent = true
    i++
  }

  // A file not ending in a newline still has one trailing row to flush.
  if (sawAnyContent || field.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Serialises rows into CSV text, quoting any cell containing a comma, quote, or newline. */
export function stringifyCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell)
          return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
        })
        .join(','),
    )
    .join('\r\n')
}

/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
