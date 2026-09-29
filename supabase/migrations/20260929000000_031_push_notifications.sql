-- =====================================================================
-- 031: Manual push notifications (Android, admin-sent via FCM).
--
-- Two tables:
--   - device_push_tokens: one row per installed app on a device (keyed by
--     the FCM registration token itself, not by user+device), owned by
--     whoever is signed in on it right now. Fully self-service from the
--     client: a signed-in user may insert/update/delete only their own
--     row(s) by user_id = auth.uid(); nobody may SELECT another user's
--     token through RLS. The one place a token is ever read across users
--     is the send-push-notification Edge Function, which uses the
--     service-role client and so bypasses RLS entirely — there is
--     deliberately no admin SELECT policy here (unlike most admin-visible
--     tables in this schema): admins never need to see a raw token.
--   - notifications_sent: an append-only audit log, written only by the
--     Edge Function's service-role client. Admin-only SELECT; no INSERT,
--     UPDATE or DELETE policy for any client role (same "permanent
--     record" shape as `deletion_requests`, migration 027).
--
-- Same self-scoped-policy shape used since migration 014: an owner's
-- already-issued token stops working the moment they are trashed.
-- =====================================================================

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_device_push_tokens_user_id on public.device_push_tokens(user_id);

comment on table public.device_push_tokens is
  'FCM registration tokens for the Android app (migration 031). One row per installed app on a device, upserted on the unique token; user_id is whoever is currently signed in on that device. Never read across users except by the send-push-notification Edge Function (service role, bypasses RLS).';

create trigger trg_device_push_tokens_updated_at
before update on public.device_push_tokens
for each row execute function public.fn_set_updated_at();

alter table public.device_push_tokens enable row level security;

create policy device_push_tokens_select_self on public.device_push_tokens
  for select using (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

create policy device_push_tokens_insert_self on public.device_push_tokens
  for insert with check (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

create policy device_push_tokens_update_self on public.device_push_tokens
  for update using (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()))
  with check (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

create policy device_push_tokens_delete_self on public.device_push_tokens
  for delete using (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

-- ---------------------------------------------------------------------

create table public.notifications_sent (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  target_type text not null check (target_type in ('all', 'course', 'user')),
  target_course_id uuid references public.courses(id),
  target_user_id uuid references public.profiles(id),
  recipient_count integer,
  sent_at timestamptz not null default now(),
  constraint notifications_sent_target_shape check (
    (target_type = 'all' and target_course_id is null and target_user_id is null) or
    (target_type = 'course' and target_course_id is not null and target_user_id is null) or
    (target_type = 'user' and target_course_id is null and target_user_id is not null)
  )
);

comment on table public.notifications_sent is
  'Append-only audit log of manual admin-sent push notifications (migration 031). Written only by the send-push-notification Edge Function''s service-role client. recipient_count is null for a topic send (target_type=''all''): FCM does not report topic subscriber counts, and this column is never guessed.';

create index idx_notifications_sent_sent_at on public.notifications_sent(sent_at desc);

alter table public.notifications_sent enable row level security;

create policy notifications_sent_admin_select on public.notifications_sent
  for select using (public.fn_is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role: only the service-role
-- client (used exclusively by the Edge Function) can write this table, and
-- service_role bypasses RLS. A permanent record, like `deletion_requests`.
