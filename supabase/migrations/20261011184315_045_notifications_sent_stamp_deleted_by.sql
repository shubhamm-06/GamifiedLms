-- =====================================================================
-- 045: notifications_sent gets the same fn_stamp_deleted_by trigger every
-- other trash-first table has (migration 013).
--
-- Without this, the admin trash/restore UI (admin-notifications task) would
-- have to send deleted_by itself from the client, which every other
-- trash-first entity never does -- and a client-supplied value can be
-- forged. With it, the UI sends only deleted_at (exactly like courses,
-- modules, lessons, games, badges); the trigger stamps/clears deleted_by
-- from auth.uid() itself.
--
-- Trigger name sorts after trg_notifications_sent_guard_admin_update
-- (migration 042) alphabetically, but firing order between them doesn't
-- matter: the guard only compares OLD vs NEW on every column except
-- deleted_at/deleted_by (both always allowed to change), and this trigger
-- only ever touches deleted_by itself.
-- =====================================================================

create trigger trg_notifications_sent_stamp_deleted_by
before insert or update on public.notifications_sent
for each row execute function public.fn_stamp_deleted_by();
