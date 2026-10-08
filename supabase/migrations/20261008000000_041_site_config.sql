-- 041: admin Settings, Phase 1 (branding, theme, terminology, features).
--
-- A key/value table, `site_config`, one row per settings section. It is NOT the
-- older `app_settings` singleton (migration 010, locked shape in rules.md), which
-- stays untouched: the new name avoids changing that table's contract.
--
-- * Four keys, seeded with '{}' ("use the code defaults"); the client merges stored
--   values over its defaults and validates every field, so a partial or invalid
--   row can never break the app.
-- * `version` is bumped by a trigger on every update, so the admin UI can save
--   compare-and-swap (`... where key = $1 and version = $2`): a stale save hits
--   zero rows and is reported as a conflict.
-- * `updated_by` and `updated_at` are stamped from the verified caller by the
--   same trigger, never taken from the client.
-- * Every insert/update writes an audit row (`site_config_audit`), through a
--   SECURITY DEFINER trigger function; clients can never write the audit table.
-- * Only admins can read or write the table directly. Everyone (anon included)
--   reads settings ONLY through `get_public_settings()`, which returns the four
--   sections and their versions and nothing else. This table must never hold
--   secrets: its whole content is public through that function.
-- * Storage bucket `branding`: public read; insert/update/delete for admins only.

create table public.site_config (
  key text primary key check (key in ('branding', 'theme', 'terminology', 'features')),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.site_config_audit (
  id bigint generated always as identity primary key,
  key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index site_config_audit_key_changed_at_idx on public.site_config_audit (key, changed_at desc);

-- Stamp version / updated_at / updated_by from the server, never the client.
create or replace function public.fn_site_config_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  else
    new.version := 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- Write the audit row. SECURITY DEFINER because clients have no write path to the audit table.
create or replace function public.fn_site_config_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_config_audit (key, old_value, new_value, changed_by)
  values (new.key, case when tg_op = 'UPDATE' then old.value end, new.value, auth.uid());
  return null;
end;
$$;

revoke all on function public.fn_site_config_stamp() from public, anon, authenticated;
revoke all on function public.fn_site_config_audit() from public, anon, authenticated;

create trigger trg_site_config_stamp
  before insert or update on public.site_config
  for each row execute function public.fn_site_config_stamp();

create trigger trg_site_config_audit
  after insert or update on public.site_config
  for each row execute function public.fn_site_config_audit();

-- RLS: admins only, no delete for anyone.
alter table public.site_config enable row level security;
alter table public.site_config_audit enable row level security;

revoke all on public.site_config from anon, authenticated;
grant select, insert, update on public.site_config to authenticated;

revoke all on public.site_config_audit from anon, authenticated;
grant select on public.site_config_audit to authenticated;

create policy site_config_admin_select on public.site_config
  for select to authenticated using (public.fn_is_admin());
create policy site_config_admin_insert on public.site_config
  for insert to authenticated with check (public.fn_is_admin());
create policy site_config_admin_update on public.site_config
  for update to authenticated using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy site_config_audit_admin_select on public.site_config_audit
  for select to authenticated using (public.fn_is_admin());

-- The one read path for everyone: the four sections and their versions, nothing else.
create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(c.key, jsonb_build_object('value', c.value, 'version', c.version)),
    '{}'::jsonb
  )
  from public.site_config c
  where c.key in ('branding', 'theme', 'terminology', 'features');
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;

-- Seed: empty sections mean "use the code defaults". Runs outside RLS; the stamp
-- trigger leaves updated_by null (no caller).
insert into public.site_config (key) values ('branding'), ('theme'), ('terminology'), ('features');

-- Storage: the branding bucket (logo, favicon, login background). Public read.
-- The bucket caps every object at 2 MB and the image types below; the client also
-- enforces 1 MB for a logo and 256 KB for a favicon. SVGs are only ever shown via <img>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding', 'branding', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do nothing;

create policy branding_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'branding' and public.fn_is_admin());
create policy branding_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'branding' and public.fn_is_admin())
  with check (bucket_id = 'branding' and public.fn_is_admin());
create policy branding_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'branding' and public.fn_is_admin());
-- Replace/remove read the row first (DELETE ... RETURNING), so admins also need a select policy.
-- Public file URLs are served by the public bucket and need no policy.
create policy branding_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'branding' and public.fn_is_admin());
