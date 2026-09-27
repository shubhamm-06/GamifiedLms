-- =====================================================================
-- 027: Self-service account deletion requests.
--
-- Consistent with this app's trash-first philosophy (migration 013): a
-- student cannot hard-delete their own account from the kid app. This adds
-- the lightweight request itself, not the fulfillment workflow — an admin
-- acting on it (trashing the user, per section 7's existing Edge Function
-- path) is a separate, later task. A request is a permanent record: no
-- UPDATE or DELETE policy for any client role, and no status column yet
-- (the brief asked for id/user_id/requested_at only).
--
-- `user_id references public.profiles(id) on delete cascade`: the Edge
-- Function's permanent-delete blocker list (schema.md, `has_history`) does
-- NOT check this table, so a request row cascades away silently if that
-- student is ever hard-deleted — acceptable since the request is moot once
-- fulfilled, but worth knowing if a blocker check is ever added generically.
-- =====================================================================

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index idx_deletion_requests_user_id on public.deletion_requests(user_id);

comment on table public.deletion_requests is
  'A student''s self-service request to delete their account (profile page, 2026-09-27). Recorded only -- no automatic action. Migration 027.';

alter table public.deletion_requests enable row level security;

-- Same "own row, minus a trashed caller's stale token" shape as every other
-- self-scoped policy since migration 014.
create policy deletion_requests_select_self on public.deletion_requests
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

create policy deletion_requests_insert_self on public.deletion_requests
  for insert with check (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));
