-- =====================================================================
-- 044: Corrects 043's push_sent comment back to a true tri-state.
--
-- 043 said push_sent always resolves to true/false (never left null). That
-- turned out to be the wrong call once the admin notifications history
-- table (admin-notifications task) needed to tell "push was never
-- requested" (send_push=false, a deliberate inbox-only send) apart from
-- "push was requested and failed outright" -- both would otherwise read as
-- false, indistinguishable from the stored row alone.
--
-- send-push-notification's code changed alongside this migration (not a
-- schema change): it now leaves push_sent null when send_push is false,
-- matching this comment. Comment-only change here, no schema/data impact.
-- =====================================================================

comment on column public.notifications_sent.push_sent is
  'TRI-STATE, not a plain boolean: null means push was never attempted (send_push=false, a deliberate inbox-only send); true/false means it was attempted and succeeded/failed. A handful of stale per-token failures does not flip this to false — see recipient_count for the successful-only count. Set by the send-push-notification Edge Function after it writes the row, never guessed.';
