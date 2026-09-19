import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AdminActionError,
  AdminNetworkError,
  bulkCreateUsers,
  type BulkCreateInputRow,
  type BulkRowResult,
} from '@/lib/adminUserApi'
import { invalidateAdminData } from '@/lib/queryClient'
import {
  IMPORT_CHUNK_SIZE,
  outcomeFromServer,
  type ImportRow,
  type SentOutcome,
} from '@/lib/userImport'

export type ImportPhase = 'idle' | 'running' | 'done'

export interface ImportProgress {
  /** 1-based number of the chunk being sent. */
  chunk: number
  chunkCount: number
  rowsDone: number
  rowsTotal: number
  /** True while waiting to re-send a chunk after a 429 or a network error. */
  retrying: boolean
}

/** Waits before each re-send of the same chunk: 1s, 2s, 4s, then give up. */
const RETRY_DELAYS_MS = [1000, 2000, 4000]

/** Gateway rate limit / temporary unavailability, as opposed to a real refusal. */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

const NO_ANSWER =
  'No answer from the server after several tries. These rows may or may not have been created — upload the file again to check (existing accounts are skipped).'

function isRetryable(err: unknown): boolean {
  if (err instanceof AdminNetworkError) return true
  return err instanceof AdminActionError && err.status !== undefined && RETRYABLE_STATUSES.has(err.status)
}

/** A refusal worth explaining in plain words; anything else keeps the server's own message. */
function refusalMessage(err: unknown): string {
  if (err instanceof AdminActionError && (err.status === 401 || err.status === 403)) {
    return 'Your admin session was not accepted. Sign in again, then upload the file again to continue.'
  }
  return err instanceof Error && err.message ? err.message : 'The request failed.'
}

type ChunkAttempt =
  | { ok: true; results: BulkRowResult[]; retried: boolean }
  | { ok: false; message: string; retried: boolean }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function sendChunk(rows: BulkCreateInputRow[], onRetry: () => void): Promise<ChunkAttempt> {
  let retried = false
  for (let attempt = 0; ; attempt++) {
    try {
      return { ok: true, results: await bulkCreateUsers(rows), retried }
    } catch (err) {
      // Deliberately not logged: nothing about this request or its answer may reach a console.
      if (!isRetryable(err)) return { ok: false, message: refusalMessage(err), retried }
      if (attempt >= RETRY_DELAYS_MS.length) return { ok: false, message: NO_ANSWER, retried }
      retried = true
      onRetry()
      await sleep(RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 250))
    }
  }
}

function chunkOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Runs an import: valid rows go to the Edge Function in sequential chunks of 25,
 * with a progress readout, retry-with-backoff on 429 / network errors, and a
 * Stop that halts after the chunk in flight. A chunk that cannot be delivered
 * ends the run (the connection is the problem, and every later chunk would hit
 * it too); its rows are marked failed and the rest are left "not attempted".
 *
 * The outcomes it returns can hold generated passwords. They live in React state
 * only — never logged, toasted, cached or stored.
 */
export function useImportUsers() {
  const queryClient = useQueryClient()
  const stopRequested = useRef(false)
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [stopping, setStopping] = useState(false)
  const [outcomes, setOutcomes] = useState<ReadonlyMap<number, SentOutcome>>(new Map())
  const [stoppedByUser, setStoppedByUser] = useState(false)
  const [haltMessage, setHaltMessage] = useState<string | null>(null)

  // Closing the tab mid-import would strand a half-done run with no results file.
  useEffect(() => {
    if (phase !== 'running') return
    const guard = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [phase])

  async function start(rows: readonly ImportRow[]) {
    const chunks = chunkOf(rows, IMPORT_CHUNK_SIZE)
    const collected = new Map<number, SentOutcome>()
    let rowsDone = 0

    stopRequested.current = false
    setStopping(false)
    setStoppedByUser(false)
    setHaltMessage(null)
    setOutcomes(new Map())
    setPhase('running')

    for (let c = 0; c < chunks.length; c++) {
      if (stopRequested.current) {
        setStoppedByUser(true)
        break
      }
      const chunk = chunks[c]
      const progressNow = { chunk: c + 1, chunkCount: chunks.length, rowsDone, rowsTotal: rows.length }
      setProgress({ ...progressNow, retrying: false })

      const attempt = await sendChunk(
        chunk.map((r) => ({
          display_name: r.displayName,
          email: r.email,
          phone_number: r.phone,
          password: r.password,
        })),
        () => setProgress({ ...progressNow, retrying: true }),
      )

      if (!attempt.ok) {
        for (const row of chunk) collected.set(row.line, { status: 'failed', reason: attempt.message })
        setHaltMessage(attempt.message)
        break
      }

      chunk.forEach((row, i) => {
        const result = attempt.results.find((r) => r.index === i)
        collected.set(
          row.line,
          result
            ? outcomeFromServer(result, {
                // A re-sent chunk may find accounts the lost first attempt created.
                interrupted: attempt.retried && row.password === '',
              })
            : { status: 'failed', reason: 'The server returned no result for this row' },
        )
      })
      rowsDone += chunk.length
      setProgress({ ...progressNow, rowsDone, retrying: false })
    }

    setOutcomes(collected)
    setPhase('done')
    setProgress(null)
    await invalidateAdminData(queryClient)
  }

  /** Halts after the chunk currently in flight; the remaining rows stay "not attempted". */
  function stop() {
    stopRequested.current = true
    setStopping(true)
  }

  function reset() {
    stopRequested.current = false
    setPhase('idle')
    setProgress(null)
    setStopping(false)
    setOutcomes(new Map())
    setStoppedByUser(false)
    setHaltMessage(null)
  }

  return { phase, progress, stopping, outcomes, stoppedByUser, haltMessage, start, stop, reset }
}
