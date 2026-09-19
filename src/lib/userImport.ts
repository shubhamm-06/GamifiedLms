import { MIN_PASSWORD_LENGTH } from '@/lib/adminConstants'
import type { BulkRowResult } from '@/lib/adminUserApi'
import { parseCsvTable, stripFormulaGuard, toCsv, type CsvColumn } from '@/lib/csv'

/** Import limits. The Edge Function enforces its own copy of the per-request ones. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const IMPORT_MAX_ROWS = 1000
export const IMPORT_CHUNK_SIZE = 25
export const MAX_DISPLAY_NAME_LENGTH = 100
export const MAX_EMAIL_LENGTH = 254

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?\d{7,15}$/

export const IMPORT_COLUMNS = ['display_name', 'email', 'phone_number', 'password'] as const
const REQUIRED_COLUMNS = ['display_name', 'email'] as const
type ImportColumn = (typeof IMPORT_COLUMNS)[number]

// ---------------------------------------------------------------------------
// Parsing and per-row validation
// ---------------------------------------------------------------------------

export type PreviewStatus = 'valid' | 'error' | 'exists' | 'trashed'

export interface ImportRow {
  /**
   * Position among the file's non-blank rows: the header is row 1, the first data
   * row is 2. Matches a spreadsheet's row number unless the file has blank lines,
   * which the parser drops.
   */
  line: number
  displayName: string
  email: string
  /** Normalised (`+` and digits only) when valid; as typed otherwise. */
  phone: string
  /** As supplied; blank means "generate one". Never rendered. */
  password: string
  status: PreviewStatus
  reasons: string[]
}

export type ParseOutcome =
  | {
      ok: true
      rows: ImportRow[]
      /** Header cells that were not one of the four known columns. */
      ignoredColumns: string[]
      /** The text contains U+FFFD, so it was probably not saved as UTF-8. */
      encodingIssue: boolean
    }
  | { ok: false; error: string }

/** Cheap checks on the picked file before reading it. */
export function checkImportFile(file: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(file.name)) return 'Only .csv files are supported.'
  if (file.size === 0) return 'The file is empty.'
  if (file.size > IMPORT_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `This file is ${mb} MB. The limit is 2 MB.`
  }
  return null
}

/** Strips spaces, dots, dashes and brackets, then accepts digits with an optional leading +. */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s().-]/g, '')
  return PHONE_PATTERN.test(stripped) ? stripped : null
}

/**
 * Reads CSV text into preview rows. Header matching is case-insensitive and
 * ignores surrounding whitespace; unknown columns are reported, not fatal.
 * `role` is one of them on purpose: everything imported is a student.
 *
 * Duplicate emails inside the file: the first row keeps the email, every later
 * row is an error pointing at it.
 */
export function parseUserImport(text: string): ParseOutcome {
  const table = parseCsvTable(text)
  if (table.fatalError) return { ok: false, error: table.fatalError }
  if (table.header.length === 0) return { ok: false, error: 'The file is empty.' }

  const index: Partial<Record<ImportColumn, number>> = {}
  const ignored: string[] = []
  table.header.forEach((cell, i) => {
    const name = cell.trim().toLowerCase()
    if (name === '') return
    if ((IMPORT_COLUMNS as readonly string[]).includes(name) && index[name as ImportColumn] === undefined) {
      index[name as ImportColumn] = i
    } else if (!ignored.includes(cell.trim())) {
      ignored.push(cell.trim())
    }
  })

  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === undefined)
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected columns: ${IMPORT_COLUMNS.join(', ')}.`,
    }
  }

  if (table.rows.length === 0) return { ok: false, error: 'The file has a header but no data rows.' }
  if (table.rows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `This file has ${table.rows.length} rows. The limit is ${IMPORT_MAX_ROWS} rows per import.`,
    }
  }

  const columnCount = table.header.length
  const firstLineByEmail = new Map<string, number>()

  const rows = table.rows.map((cells, k): ImportRow => {
    const line = k + 2
    const cell = (name: ImportColumn) => {
      const at = index[name]
      return at === undefined ? '' : (cells[at] ?? '')
    }

    // Trim first, then undo the export's formula guard, so an exported file re-imports as it was.
    const displayName = stripFormulaGuard(cell('display_name').trim())
    const email = stripFormulaGuard(cell('email').trim()).toLowerCase()
    const phoneTyped = stripFormulaGuard(cell('phone_number').trim())
    const passwordRaw = cell('password')
    const password = passwordRaw.trim() === '' ? '' : passwordRaw

    const reasons: string[] = []

    if (cells.slice(columnCount).some((c) => c.trim() !== '')) {
      reasons.push('Too many columns — check for an unquoted comma in this row')
    }

    if (!displayName) reasons.push('Name is required')
    else if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      reasons.push(`Name is longer than ${MAX_DISPLAY_NAME_LENGTH} characters`)
    }

    if (!email) reasons.push('Email is required')
    else if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
      reasons.push('Invalid email address')
    }

    let phone = phoneTyped
    if (phoneTyped) {
      const normalised = normalizePhone(phoneTyped)
      if (normalised) phone = normalised
      else reasons.push('Invalid phone number (digits with an optional leading +)')
    }

    if (password && password.length < MIN_PASSWORD_LENGTH) {
      reasons.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }

    if (email) {
      const first = firstLineByEmail.get(email)
      if (first !== undefined) reasons.push(`Duplicate of row ${first}`)
      else firstLineByEmail.set(email, line)
    }

    return {
      line,
      displayName,
      email,
      phone,
      password,
      status: reasons.length > 0 ? 'error' : 'valid',
      reasons,
    }
  })

  return { ok: true, rows, ignoredColumns: ignored, encodingIssue: text.includes('\uFFFD') }
}

export interface PreviewCounts {
  total: number
  valid: number
  exists: number
  trashed: number
  errors: number
}

export function countPreview(rows: readonly ImportRow[]): PreviewCounts {
  const count = (s: PreviewStatus) => rows.filter((r) => r.status === s).length
  return {
    total: rows.length,
    valid: count('valid'),
    exists: count('exists'),
    trashed: count('trashed'),
    errors: count('error'),
  }
}

export type AccountState = 'active' | 'trashed'

/**
 * Marks otherwise-valid rows whose email already belongs to an account. An
 * active account is skipped; a trashed one is flagged so the admin restores it
 * rather than creating a duplicate. Rows that already have errors keep them.
 */
export function markExistingAccounts(
  rows: ImportRow[],
  accounts: ReadonlyMap<string, AccountState>,
): ImportRow[] {
  return rows.map((row) => {
    if (row.status !== 'valid') return row
    const state = accounts.get(row.email)
    if (state === 'active') {
      return { ...row, status: 'exists', reasons: ['Already exists, will be skipped'] }
    }
    if (state === 'trashed') {
      return { ...row, status: 'trashed', reasons: ['In trash, restore that user instead'] }
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

type TemplateRow = Record<ImportColumn, string>

const TEMPLATE_ROWS: TemplateRow[] = [
  {
    display_name: 'Asha Verma',
    email: 'asha.verma@example.com',
    phone_number: '9876543210',
    password: 'ChangeMe-1234',
  },
  // Blank phone and password: the password is generated for this one.
  { display_name: 'Ravi Kumar', email: 'ravi.kumar@example.com', phone_number: '', password: '' },
]

export function userImportTemplateCsv(): string {
  return toCsv(
    TEMPLATE_ROWS,
    IMPORT_COLUMNS.map((name): CsvColumn<TemplateRow> => ({ header: name, value: (r) => r[name] })),
  )
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type ResultStatus = 'created' | 'skipped_exists' | 'skipped_trashed' | 'failed' | 'not_attempted'

/** What the server (or the runner) reported for one row that was sent. */
export interface SentOutcome {
  status: ResultStatus
  reason?: string
  generatedPassword?: string
  /** The row did not go cleanly even though it isn't a failure (phone not saved, password possibly lost). */
  needsAttention?: boolean
}

export interface ResultRow {
  line: number
  displayName: string
  email: string
  status: ResultStatus
  reason: string
  /** Only for a created row whose password the server generated. Memory only. */
  generatedPassword: string
  /** The account exists but needs attention (phone not saved). */
  warning: boolean
}

export const PHONE_WARNING = 'Account created, but the phone number could not be saved'
const TRASHED_REASON = 'In trash — restore that user instead'
const EXISTS_REASON = 'Already exists — skipped'
const INTERRUPTED_REASON =
  "Already exists — probably created by an interrupted attempt, so no password was received. Reset it from the user's actions"

/** Turns one server row result into an outcome the summary can show. */
export function outcomeFromServer(result: BulkRowResult, options: { interrupted: boolean }): SentOutcome {
  switch (result.status) {
    case 'created': {
      const phoneLost = result.warning === 'phone_not_saved'
      return {
        status: 'created',
        reason: phoneLost ? PHONE_WARNING : '',
        generatedPassword: result.generated_password,
        needsAttention: phoneLost,
      }
    }
    case 'skipped_exists':
      // After a retried request the account may have been made by the attempt
      // whose answer was lost — and with it, its generated password.
      return options.interrupted
        ? { status: 'skipped_exists', reason: INTERRUPTED_REASON, needsAttention: true }
        : { status: 'skipped_exists', reason: EXISTS_REASON }
    case 'skipped_trashed':
      return { status: 'skipped_trashed', reason: TRASHED_REASON }
    default:
      return { status: 'failed', reason: result.reason ?? 'The account could not be created' }
  }
}

/**
 * One result row per file row, in file order: rows rejected in the preview are
 * failures, rows skipped in the preview are skips, and rows that were sent take
 * whatever the server said — or "not attempted" if the import stopped first.
 */
export function buildResultRows(
  rows: readonly ImportRow[],
  sent: ReadonlyMap<number, SentOutcome>,
): ResultRow[] {
  return rows.map((row): ResultRow => {
    const base = { line: row.line, displayName: row.displayName, email: row.email }
    const none = { generatedPassword: '', warning: false }

    if (row.status === 'error') return { ...base, ...none, status: 'failed', reason: row.reasons.join('; ') }
    if (row.status === 'exists') return { ...base, ...none, status: 'skipped_exists', reason: EXISTS_REASON }
    if (row.status === 'trashed') return { ...base, ...none, status: 'skipped_trashed', reason: TRASHED_REASON }

    const outcome = sent.get(row.line)
    if (!outcome) {
      return { ...base, ...none, status: 'not_attempted', reason: 'Not imported — the import was stopped' }
    }
    return {
      ...base,
      status: outcome.status,
      reason: outcome.reason ?? '',
      generatedPassword: outcome.generatedPassword ?? '',
      warning: outcome.needsAttention === true,
    }
  })
}

export interface ResultSummary {
  created: number
  skipped: number
  failed: number
  notAttempted: number
  /** Created accounts whose password only the results file holds. */
  generatedPasswords: number
  /** Created accounts that need attention. */
  warnings: number
}

export function summarizeResults(results: readonly ResultRow[]): ResultSummary {
  const count = (pred: (r: ResultRow) => boolean) => results.filter(pred).length
  return {
    created: count((r) => r.status === 'created'),
    skipped: count((r) => r.status === 'skipped_exists' || r.status === 'skipped_trashed'),
    failed: count((r) => r.status === 'failed'),
    notAttempted: count((r) => r.status === 'not_attempted'),
    generatedPasswords: count((r) => r.generatedPassword !== ''),
    warnings: count((r) => r.warning),
  }
}

const RESULT_COLUMNS: CsvColumn<ResultRow>[] = [
  { header: 'email', value: (r) => r.email },
  { header: 'status', value: (r) => r.status },
  { header: 'reason', value: (r) => r.reason },
  { header: 'generated_password', value: (r) => r.generatedPassword },
]

/** The downloadable results file. Built on demand from memory; nothing stores it. */
export function resultsToCsv(results: readonly ResultRow[]): string {
  return toCsv(results, RESULT_COLUMNS)
}
