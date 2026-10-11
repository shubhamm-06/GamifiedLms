-- =====================================================================
-- 042: In-app notifications inbox for students.
--
-- notifications_sent (migration 031) was a write-only, admin-only audit
-- log of manual pushes. This migration turns it into the source of truth
-- for a persistent student inbox too: push stays one delivery channel, the
-- stored row is what a student actually sees. Read-time feed, no
-- per-student rows, no read tracking in the database (rules.md).
--
-- Student read access is a security-definer-style view (the migration 003
-- pattern: a plain CREATE VIEW owned by a role that bypasses RLS on the
-- base tables, with its own filter standing in for row security, then
-- locked down the migration-016 way — revoke all, grant select back to
-- authenticated only). It exposes only what a student needs (never
-- `sent_by` or other audit columns) and is stricter about enrollment than
-- `fn_is_enrolled` on purpose: it also checks `expires_at`, which nothing
-- else in the engine reads yet (`schema.md`'s own "Finding, not changed"
-- note on enrollment expiry) — a notification for a course a student's
-- access has since expired on should not keep showing.
--
-- Admin soft delete: the same blocklist guard-trigger shape as the
-- payments guard (migration 009) — an admin may change only `deleted_at`/
-- `deleted_by`, and may hard-delete only an already-trashed row. The admin
-- UI for this is a later task; the schema is ready for it now.
-- =====================================================================

alter table public.notifications_sent
  add column kind text not null default 'announcement' check (kind in ('announcement', 'system')),
  add column show_in_inbox boolean not null default true,
  add column push_sent boolean,
  add column deep_link text check (deep_link is null or (deep_link like '/%' and length(deep_link) <= 200)),
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id);

comment on table public.notifications_sent is
  'The notification store AND an append-only audit log (migration 031, extended 042). Written only by the send-push-notification Edge Function''s service-role client, except deleted_at/deleted_by (admin soft delete, guarded). Students read their own feed through public.v_my_notifications, never this table directly. recipient_count is null for a topic send (target_type=''all''): FCM does not report topic subscriber counts, and this column is never guessed. push_sent is null when push was never attempted (show_in_inbox-only sends), true/false once it was.';

comment on column public.notifications_sent.kind is
  'announcement: an admin-composed message. system: reserved for a future automatic notification (migration 042 does not send any) — out of scope beyond the column existing.';
comment on column public.notifications_sent.show_in_inbox is
  'False hides the row from every student''s inbox (v_my_notifications) without touching push — e.g. a push-only reminder with nothing worth keeping in history.';
comment on column public.notifications_sent.deep_link is
  'An in-app path only (must start with ''/''), never an external URL. Null means tapping the notification just opens the inbox.';

-- ---------------------------------------------------------------------
-- Feed index: exactly the rows and order v_my_notifications reads.
-- ---------------------------------------------------------------------
create index idx_notifications_sent_feed on public.notifications_sent (sent_at desc)
  where deleted_at is null and show_in_inbox;

create index if not exists idx_notifications_sent_target_course on public.notifications_sent (target_course_id)
  where target_course_id is not null;
create index if not exists idx_notifications_sent_target_user on public.notifications_sent (target_user_id)
  where target_user_id is not null;

-- ---------------------------------------------------------------------
-- Student feed view. auth.uid() inside the view is the only "row security"
-- here — the view bypasses RLS on notifications_sent/enrollments/profiles
-- the same way profiles_public and quiz_questions_public already do, so
-- every branch below has to be airtight on its own.
-- ---------------------------------------------------------------------
create or replace view public.v_my_notifications as
select n.id, n.title, n.body, n.kind, n.deep_link, n.sent_at
from public.notifications_sent n
where n.deleted_at is null
  and n.show_in_inbox
  and not public.fn_user_is_trashed(auth.uid())
  and (
    (
      n.target_type = 'all'
      and n.sent_at >= (select p.created_at from public.profiles p where p.id = auth.uid())
    )
    or (
      n.target_type = 'user'
      and n.target_user_id = auth.uid()
    )
    or (
      n.target_type = 'course'
      and public.fn_course_is_reachable(n.target_course_id)
      and exists (
        select 1
        from public.enrollments e
        where e.user_id = auth.uid()
          and e.course_id = n.target_course_id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and e.enrolled_at <= n.sent_at
      )
    )
  );

comment on view public.v_my_notifications is
  'The signed-in student''s own notification feed (migration 042): only id/title/body/kind/deep_link/sent_at, never sent_by or any other audit column. A row is visible only once it was sent after the student joined (profiles.created_at for ''all'', the enrollment''s enrolled_at for ''course''), and a ''course'' row additionally needs a currently-active, non-expired enrollment in a still-reachable (published, not trashed) course. No read-tracking of any kind lives here or anywhere else (rules.md) — "unread" is computed entirely on the device from a locally-stored last-seen timestamp.';

revoke all on public.v_my_notifications from anon, authenticated, public;
grant select on public.v_my_notifications to authenticated;

-- ---------------------------------------------------------------------
-- Admin soft delete: a blocklist guard (fn_guard_payment_admin_update's
-- shape, migration 009) so an admin's UPDATE can only ever touch
-- deleted_at/deleted_by — every other column stays exactly what the Edge
-- Function wrote. service_role (the Edge Function itself) is exempt, same
-- as the payments guard.
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_notifications_sent_admin_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.sent_by is distinct from old.sent_by
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.target_type is distinct from old.target_type
       or new.target_course_id is distinct from old.target_course_id
       or new.target_user_id is distinct from old.target_user_id
       or new.recipient_count is distinct from old.recipient_count
       or new.sent_at is distinct from old.sent_at
       or new.kind is distinct from old.kind
       or new.show_in_inbox is distinct from old.show_in_inbox
       or new.push_sent is distinct from old.push_sent
       or new.deep_link is distinct from old.deep_link
    then
      raise exception 'only deleted_at and deleted_by can be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notifications_sent_guard_admin_update
before update on public.notifications_sent
for each row execute function public.fn_guard_notifications_sent_admin_update();

create policy notifications_sent_admin_update on public.notifications_sent
  for update to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

-- Permanent delete only from trash, same shape as payments_admin_delete_from_trash
-- (migration 009) and the trash-first tables (migration 013): never a live row.
create policy notifications_sent_admin_delete on public.notifications_sent
  for delete to authenticated using (public.fn_is_admin() and deleted_at is not null);

-- Students and anon still have no direct grant on notifications_sent itself
-- (unchanged from migration 031) — only the new admin UPDATE/DELETE policies
-- and the existing admin SELECT policy apply, all gated on fn_is_admin().
