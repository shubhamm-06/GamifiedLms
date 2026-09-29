import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** An admin action the server refused, with the reason it gave. */
export class AdminActionError extends Error {
  code?: string
  blockers?: Record<string, number>
  /** HTTP status when the refusal came from a non-2xx response. */
  status?: number

  constructor(message: string, code?: string, blockers?: Record<string, number>, status?: number) {
    super(message)
    this.name = 'AdminActionError'
    this.code = code
    this.blockers = blockers
    this.status = status
  }
}

/** The request never got a usable answer (offline, dropped connection, relay failure). */
export class AdminNetworkError extends Error {
  constructor() {
    super('Could not reach the server. Please try again.')
    this.name = 'AdminNetworkError'
  }
}

interface EdgeEnvelope {
  success: boolean
  error?: string
  code?: string
  blockers?: Record<string, number>
}

/**
 * Invokes an admin-only Edge Function and normalises its result into
 * "returns data" or "throws Error", so TanStack Query's onError path gets a
 * real message. Shared by every admin Edge Function call (`adminUserApi.ts`,
 * `adminNotificationsApi.ts`): the unwrapping below is identical regardless
 * of what the function actually does.
 *
 * supabase-js surfaces any non-2xx as a FunctionsHttpError whose own message
 * is just "Edge Function returned a non-2xx status code" — the useful
 * message is in the un-read response body, so it's pulled out here. Without
 * this every server-side validation error would reach the user as that same
 * meaningless string.
 */
export async function invokeEdgeFunction<T extends EdgeEnvelope>(
  name: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    // An aborted request surfaces below as a network error, not a hang.
    timeout: options?.timeoutMs,
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status
      try {
        const respBody = (await error.context.json()) as EdgeEnvelope
        if (respBody?.error) throw new AdminActionError(respBody.error, respBody.code, respBody.blockers, status)
      } catch (parseError) {
        // Only the AdminActionError thrown above should propagate; an unreadable
        // body (a gateway HTML page, say) falls through to the status-only error.
        if (parseError instanceof AdminActionError) throw parseError
      }
      // A non-2xx with no readable body (a gateway 429/502/504, say): keep the status.
      throw new AdminActionError('The request failed.', undefined, undefined, status)
    }
    throw new AdminNetworkError()
  }

  if (!data || data.success === false) {
    const failure = data as unknown as EdgeEnvelope | null
    throw new AdminActionError(failure?.error ?? 'The request failed.', failure?.code, failure?.blockers)
  }

  return data
}
