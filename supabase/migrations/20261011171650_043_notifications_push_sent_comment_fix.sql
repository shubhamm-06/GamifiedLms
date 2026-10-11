-- =====================================================================
-- 043: Comment-only fix for notifications_sent.push_sent (migration 042).
--
-- 042's own column comment said push_sent stays null for a push that was
-- never attempted (show_in_inbox-only sends). The actual, locked behavior
-- implemented in the send-push-notification Edge Function (STEP 2 of the
-- notifications-inbox brief) is stricter: push_sent always resolves to
-- true or false once the function has returned -- false means either the
-- push failed outright or send_push was deliberately false, never "still
-- unknown forever". No schema, data or type change -- comment only.
-- =====================================================================

comment on column public.notifications_sent.push_sent is
  'true once the push attempt succeeded; false when it failed outright, or when send_push was false (skipped on purpose). Set by the send-push-notification Edge Function after it writes the row, never guessed. A handful of stale per-token failures does not flip this to false — see recipient_count for the successful-only count.';
