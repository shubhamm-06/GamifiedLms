import { invokeEdgeFunction } from './edgeFunction'

const FUNCTION_NAME = 'send-push-notification'

export type NotificationTarget =
  | { type: 'all' }
  | { type: 'course'; courseId: string }
  | { type: 'user'; userId: string }

interface SendNotificationInput {
  title: string
  body: string
  target: NotificationTarget
}

interface SendSuccess {
  success: true
  /** Null for a topic send (`target.type === 'all'`) — FCM does not report topic subscriber counts. */
  recipientCount: number | null
}

/**
 * Calls `send-push-notification` (migration 031). Same authenticated-fetch
 * pattern as `adminUserApi.ts` (`lib/edgeFunction.ts` does the actual
 * unwrapping) — the caller's session token rides along automatically via
 * `supabase.functions.invoke`.
 *
 * NOT YET DEPLOYED (`env-deploy.md` "Push notifications"): this call will
 * fail until it is. supabase-js reports an undeployed/missing function as a
 * `FunctionsHttpError` (typically 404), which `invokeEdgeFunction` turns into
 * an `AdminActionError` with a readable-but-generic message — the compose
 * form's existing failure toast covers it without any special casing, so it
 * already fails in a reasonable way rather than hanging or showing a raw
 * network error.
 */
export async function sendPushNotification(input: SendNotificationInput): Promise<{ recipientCount: number | null }> {
  const data = await invokeEdgeFunction<SendSuccess>(FUNCTION_NAME, {
    title: input.title,
    body: input.body,
    target: input.target,
  })
  return { recipientCount: data.recipientCount }
}
