-- =====================================================================
-- Gamified LMS — Migration 004: admin-scoped writes
-- Implements "Option B" for the service_role wall on enrollments and
-- xp_transactions (manual awards). payments gets a narrower path:
-- reconciliation fields only, guarded so an admin can never make the
-- row claim a payment the gateway didn't report.
-- =====================================================================

-- ---------------------------------------------------------------------
-- enrollments — admin can create/modify/revoke directly
-- ---------------------------------------------------------------------
create policy enrollments_admin_insert on public.enrollments
  for insert with check (public.fn_is_admin());

create policy enrollments_admin_update on public.enrollments
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy enrollments_admin_delete on public.enrollments
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- xp_transactions — admin can insert manual awards/corrections only.
-- The WITH CHECK ties this policy to source_type = 'manual' so an admin
-- account can't spoof a 'lesson'/'quiz'/'game' award through this path;
-- the append-only ledger stays honest about where XP actually came from.
-- ---------------------------------------------------------------------
create policy xp_transactions_admin_manual_insert on public.xp_transactions
  for insert with check (public.fn_is_admin() and source_type = 'manual');

-- ---------------------------------------------------------------------
-- profiles.role — allow admins to change other users' roles, not just
-- service_role. Two parts: a policy permitting the update, and updating
-- the existing guard trigger to allow it through.
-- ---------------------------------------------------------------------
create policy profiles_admin_update on public.profiles
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create or replace function public.fn_prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.fn_is_admin()
  then
    raise exception 'role cannot be changed by client';
  end if;
  return new;
end;
$$;
-- (trg_profiles_prevent_role_change already points at this function —
-- create or replace is sufficient, no need to recreate the trigger.)

-- ---------------------------------------------------------------------
-- payments — scoped admin reconciliation, not open insert/update.
-- Adds two new columns and a guard trigger that blocks changes to every
-- other column unless the write comes from service_role (the webhook).
-- ---------------------------------------------------------------------
alter table public.payments
  add column reconciliation_status text not null default 'unresolved'
    check (reconciliation_status in ('unresolved', 'resolved')),
  add column reconciliation_note text;

create or replace function public.fn_guard_payment_admin_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.user_id is distinct from old.user_id
       or new.course_id is distinct from old.course_id
       or new.provider is distinct from old.provider
       or new.provider_payment_id is distinct from old.provider_payment_id
       or new.email is distinct from old.email
       or new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.status is distinct from old.status
       or new.raw_payload is distinct from old.raw_payload
       or new.received_at is distinct from old.received_at
    then
      raise exception 'only reconciliation_status and reconciliation_note can be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_payments_guard_admin_update
before update on public.payments
for each row execute function public.fn_guard_payment_admin_update();

create policy payments_admin_update on public.payments
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());
