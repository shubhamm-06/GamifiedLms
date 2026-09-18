-- ---------------------------------------------------------------------
-- 010. Platform settings — a deliberate singleton table
-- ---------------------------------------------------------------------
-- One row, seeded right here. No INSERT policy exists for any client role
-- (anon or authenticated) — that absence is the actual enforcement that a
-- second row can never be created through the app; this migration's own
-- insert below is the only one that will ever run, since it executes
-- outside RLS. No DELETE policy either, for the same reason: nothing
-- should ever be able to remove the one row config depends on.
--
-- Closes two confirmed gaps:
--   - default_currency: referenced by courses.currency/payments.currency
--     defaults, but nothing today lets an admin actually set what "the
--     platform default" is (see context.md).
--   - quiz_pass_threshold_percent: needed before quiz grading exists,
--     currently stored nowhere (see state.md). Not consumed by anything
--     yet — this task only makes the value settable and storable.
--
-- site_name replaces AdminLayout's hardcoded sidebar text. site_url is
-- forward-looking (nothing is deployed yet, per env-deploy.md) but the
-- field should exist ahead of that rather than being added later as a
-- second migration for one column.
-- ---------------------------------------------------------------------

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  default_currency text not null default 'INR',
  quiz_pass_threshold_percent int not null default 70,
  site_name text not null default 'Wisdom Hatch Kids',
  site_url text,
  support_email text,
  terms_url text,
  privacy_url text
);

alter table public.app_settings enable row level security;

-- Open to everyone, including anon — none of this is sensitive, and
-- site_name specifically needs to be readable from /login before any
-- session exists.
create policy app_settings_select_public on public.app_settings
  for select using (true);

create policy app_settings_admin_update on public.app_settings
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

insert into public.app_settings default values;
