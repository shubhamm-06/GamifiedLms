-- ---------------------------------------------------------------------
-- 009. Trash / permanent delete for payments
-- ---------------------------------------------------------------------
-- Adds `deleted_at` (nullable timestamptz, no default — null means active,
-- non-null means trashed). This is the ONLY soft-delete column anywhere in
-- this schema, deliberately scoped to payments alone — see rules.md for why
-- this isn't a precedent to generalize to other tables without the same
-- reasoning: payments are real financial records an admin may want to pull
-- out of the active list and KPI totals without risking an irreversible
-- mistake, which courses/games already solve differently (archive-or-real-
-- delete, per their own rules.md entries) and don't need a second pattern.
--
-- Permanent delete is a real DELETE. There has never been an admin delete
-- policy on payments before this (see rules.md's existing "no delete action
-- at all" invariant, deliberately superseded here, not silently
-- contradicted) — payments_admin_delete_from_trash only allows it once a
-- row is already trashed, enforced by RLS at the database level, not left
-- as a UI convention a differently-written client could bypass.
--
-- Trashing/restoring never touches the linked enrollment — a payment's
-- deleted_at only affects the payment record's own visibility and
-- reporting, never a student's access.
-- ---------------------------------------------------------------------

alter table public.payments add column deleted_at timestamptz;

-- fn_guard_payment_admin_update's live source was re-read (via
-- pg_get_functiondef) before this edit, not reconstructed from memory — it
-- is a BLOCKLIST of columns an admin may not touch (raises if any of them
-- differ from old to new), not an explicit allowlist. deleted_at was never
-- named in that blocklist, so admin updates to it were already permitted
-- the instant the column above was added — this CREATE OR REPLACE changes
-- only the error message text to stay accurate, not the actual guard logic.
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
      raise exception 'only reconciliation_status, reconciliation_note, and deleted_at can be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;

-- The actual enforcement mechanism: a payment can never be hard-deleted
-- unless it is already trashed, at the RLS level — not a UI convention that
-- could be bypassed by calling delete a different way.
create policy payments_admin_delete_from_trash on public.payments
  for delete to authenticated using (public.fn_is_admin() and deleted_at is not null);
