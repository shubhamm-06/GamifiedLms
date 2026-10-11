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
  /** Default true server-side when omitted. */
  sendPush?: boolean
  /** Default true server-side when omitted. */
  showInInbox?: boolean
  /** Must start with `/` and be <= 200 chars; null/omitted clears it. */
  deepLink?: string | null
}

interface SendSuccess {
  success: true
  id: string
  /** Null for a topic send (`target.type === 'all'`) — FCM does not report topic subscriber counts. */
  recipientCount: number | null
  /** Tri-state (migration 044): null = push never attempted (`sendPush: false`); true/false = attempted, outcome. */
  pushSent: boolean | null
  /** Present only when the push failed but the row was still saved — STEP 1's "saved but push failed" case. */
  warning?: string
}

export interface SendNotificationResult {
  id: string
  recipientCount: number | null
  pushSent: boolean | null
  warning?: string
}

/**
 * Calls `send-push-notification` (migration 031; extended migration 042/STEP 2
 * of the admin-notifications task for `sendPush`/`showInInbox`/`deepLink`).
 * Same authenticated-fetch pattern as `adminUserApi.ts` (`lib/edgeFunction.ts`
 * does the actual unwrapping) — the caller's session token rides along
 * automatically via `supabase.functions.invoke`. Deployed, ACTIVE, version 5.
 */
export async function sendPushNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
  const data = await invokeEdgeFunction<SendSuccess>(FUNCTION_NAME, {
    title: input.title,
    body: input.body,
    target: input.target,
    send_push: input.sendPush,
    show_in_inbox: input.showInInbox,
    deep_link: input.deepLink,
  })
  return { id: data.id, recipientCount: data.recipientCount, pushSent: data.pushSent, warning: data.warning }
}
