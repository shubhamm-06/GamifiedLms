-- ---------------------------------------------------------------------
-- 008. Manual order providers
-- ---------------------------------------------------------------------
-- A configurable list backing Add Order's Provider dropdown. Internal
-- config only — never client-facing, hence admin-only on every operation.
--
-- payments.provider stays plain text, NOT a foreign key to this table
-- (see rules.md). This table only sources the dropdown's options; nothing
-- at the DB level enforces that a payment's provider value matches an
-- active (or even existing) row here.
-- ---------------------------------------------------------------------

create table public.manual_order_providers (
  id          uuid primary key default gen_random_uuid(),
  label       text unique not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.manual_order_providers enable row level security;

create policy manual_order_providers_admin_select on public.manual_order_providers
  for select using (public.fn_is_admin());

create policy manual_order_providers_admin_insert on public.manual_order_providers
  for insert with check (public.fn_is_admin());

create policy manual_order_providers_admin_update on public.manual_order_providers
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy manual_order_providers_admin_delete on public.manual_order_providers
  for delete using (public.fn_is_admin());

-- Pulled directly from the placeholder text already in AddOrderDialog
-- ("e.g. bank_transfer, cash, comp"), not invented — gives the feature
-- something usable on first run instead of an empty dropdown with no way
-- to add to it.
insert into public.manual_order_providers (label) values
  ('bank_transfer'),
  ('cash'),
  ('comp');
