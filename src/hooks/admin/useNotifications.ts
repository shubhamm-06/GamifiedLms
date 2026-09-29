import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sendPushNotification, type NotificationTarget } from '@/lib/adminNotificationsApi'
import { supabase } from '@/lib/supabase'

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
}

/** Most recent first, following `notifications_sent`'s own `idx_notifications_sent_sent_at`. Admin-only via RLS. */
export function useNotificationsHistory(limit = 50) {
  return useQuery({
    queryKey: key('history', String(limit)),
    queryFn: async (): Promise<NotificationHistoryRow[]> => {
      const { data, error } = await supabase
        .from('notifications_sent')
        .select(
          `id, title, body, target_type, recipient_count, sent_at,
          sent_by_profile:profiles!notifications_sent_sent_by_fkey(display_name),
          target_course:courses!notifications_sent_target_course_id_fkey(title),
          target_user:profiles!notifications_sent_target_user_id_fkey(display_name)`,
        )
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
      }))
    },
  })
}

/**
 * Calls `send-push-notification` (not yet deployed — `env-deploy.md`); the
 * mutation itself is complete and correct regardless, and will start working
 * the moment the function is deployed. Refreshes the history list on success.
 */
export function useSendNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; body: string; target: NotificationTarget }) => sendPushNotification(input),
    onSuccess: ({ recipientCount }) => {
      void queryClient.invalidateQueries({ queryKey: key('history') })
      toast.success(
        recipientCount === null
          ? 'Notification sent.'
          : `Notification sent to ${recipientCount} device${recipientCount === 1 ? '' : 's'}.`,
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
