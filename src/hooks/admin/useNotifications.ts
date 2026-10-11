import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sendPushNotification, type NotificationTarget } from '@/lib/adminNotificationsApi'
import { supabase } from '@/lib/supabase'
import { getTerms as tw } from '@/lib/settings/terms'

const key = (...parts: string[]) => ['admin', 'notifications', ...parts]

export interface NotificationHistoryRow {
  id: string
  title: string
  body: string
  target_type: string
  recipient_count: number | null
  sent_at: string
  sent_by_name: string | null
  target_course_title: string | null
  target_user_name: string | null
  kind: string
  show_in_inbox: boolean
  /** Tri-state (migration 044): null = push never requested; true/false = requested, outcome. */
  push_sent: boolean | null
  deep_link: string | null
}

/** "Push sent" / "Push failed" / "Inbox only" / "Push only" — the four states STEP 2 asks for. */
export function deliveryLabel(row: Pick<NotificationHistoryRow, 'push_sent' | 'show_in_inbox'>): string {
  if (row.push_sent === false) return 'Push failed'
  if (row.push_sent === null) return row.show_in_inbox ? 'Inbox only' : 'Push failed'
  return row.show_in_inbox ? 'Push sent' : 'Push only'
}

/** "Everyone" / the course title / the student's name — shared by the compose preview and the history table. */
export function targetLabel(row: Pick<NotificationHistoryRow, 'target_type' | 'target_course_title' | 'target_user_name'>): string {
  if (row.target_type === 'course') return row.target_course_title ?? `${tw().term('course')}`
  if (row.target_type === 'user') return row.target_user_name ?? 'A student'
  return 'Everyone'
}

/** Most recent first, following `notifications_sent`'s own `idx_notifications_sent_sent_at`. Admin-only via RLS. Excludes trashed rows — those live on the Trash page's Notifications tab. */
export function useNotificationsHistory(limit = 100) {
  return useQuery({
    queryKey: key('history', String(limit)),
    queryFn: async (): Promise<NotificationHistoryRow[]> => {
      const { data, error } = await supabase
        .from('notifications_sent')
        .select(
          `id, title, body, target_type, recipient_count, sent_at, kind, show_in_inbox, push_sent, deep_link,
          sent_by_profile:profiles!notifications_sent_sent_by_fkey(display_name),
          target_course:courses!notifications_sent_target_course_id_fkey(title),
          target_user:profiles!notifications_sent_target_user_id_fkey(display_name)`,
        )
        .is('deleted_at', null)
        .order('sent_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        target_type: row.target_type,
        recipient_count: row.recipient_count,
        sent_at: row.sent_at,
        sent_by_name: row.sent_by_profile?.display_name ?? null,
        target_course_title: row.target_course?.title ?? null,
        target_user_name: row.target_user?.display_name ?? null,
        kind: row.kind,
        show_in_inbox: row.show_in_inbox,
        push_sent: row.push_sent,
        deep_link: row.deep_link,
      }))
    },
  })
}

/**
 * Calls `send-push-notification` (deployed, ACTIVE, version 5). Refreshes the
 * history list on success; the three response shapes STEP 1 asks for are
 * told apart by `pushSent` (tri-state) and `warning`, not by guessing from
 * `recipientCount` alone.
 */
export function useSendNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      title: string
      body: string
      target: NotificationTarget
      sendPush: boolean
      showInInbox: boolean
      deepLink: string | null
    }) => sendPushNotification(input),
    onSuccess: ({ pushSent, warning }) => {
      void queryClient.invalidateQueries({ queryKey: key('history') })
      if (warning) {
        toast.warning(warning)
      } else if (pushSent === null) {
        toast.success('Saved to the student inbox (no push sent).')
      } else {
        toast.success('Sent.')
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
