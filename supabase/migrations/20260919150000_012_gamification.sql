-- ---------------------------------------------------------------------
-- 012. Gamification: level thresholds, fn_compute_level rewrite,
--      lesson-completion XP award
-- ---------------------------------------------------------------------
-- 1. level_thresholds: an admin-editable table replacing the hardcoded
--    level curve in fn_compute_level.
-- 2. A DB-level trigger enforcing strictly increasing xp_required — a
--    misordered table would make level computation behave confusingly, so
--    this is enforced here, not just in the UI.
-- 3. fn_compute_level rewritten to read that table (IMMUTABLE -> STABLE,
--    since it now depends on mutable table contents).
-- 4. One-time backfill of user_stats.level.
-- 5. fn_award_lesson_xp + trigger: the actual XP award on lesson
--    completion, independent of the existing counter-bump trigger.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. level_thresholds
-- ---------------------------------------------------------------------
create table public.level_thresholds (
  level       int primary key,
  xp_required int not null
);

alter table public.level_thresholds enable row level security;

-- Readable by any signed-in user (a level-progress UI will eventually need
-- it); writable by admins only.
create policy level_thresholds_select_authenticated on public.level_thresholds
  for select to authenticated using (true);

create policy level_thresholds_admin_insert on public.level_thresholds
  for insert with check (public.fn_is_admin());

create policy level_thresholds_admin_update on public.level_thresholds
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy level_thresholds_admin_delete on public.level_thresholds
  for delete using (public.fn_is_admin());

-- Seeded by computing from the OLD fn_compute_level math itself (inlined
-- here, so this doesn't depend on the function's state at run time) —
-- smallest xp at which the old formula first reaches each level — not
-- arbitrary round numbers, so there's no discontinuity for anyone who
-- already has XP. Level 1 = 0.
insert into public.level_thresholds (level, xp_required)
select n,
       (select min(x)
          from generate_series(0, ceil(100 * power((n - 1)::numeric, 1.5))::int + 2) x
         where greatest(1, floor(power(x::numeric / 100, 1.0 / 1.5))::int + 1) >= n)
  from generate_series(1, 30) n;

-- ---------------------------------------------------------------------
-- 2. Strict-monotonicity validation trigger
-- ---------------------------------------------------------------------
-- Rejects an insert/update where this level's xp_required isn't strictly
-- greater than the row directly below it AND strictly less than the row
-- directly above it (where those neighbors exist). Level 1's "must exist,
-- must stay 0" rule is deliberately NOT special-cased here — it's
-- protected in the UI instead (can't delete, xp_required disabled);
-- fn_compute_level tolerates a missing/nonzero level 1 by falling back to
-- level 1 anyway (coalesce below).
create or replace function public.fn_validate_level_threshold()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_self  int := case when tg_op = 'UPDATE' then old.level else new.level end;
  v_below record;
  v_above record;
begin
  select level, xp_required into v_below
    from public.level_thresholds
   where level < new.level and level <> v_self
   order by level desc limit 1;

  select level, xp_required into v_above
    from public.level_thresholds
   where level > new.level and level <> v_self
   order by level asc limit 1;

  if v_below.level is not null and new.xp_required <= v_below.xp_required then
    raise exception 'Level % needs more XP than level % (%).',
      new.level, v_below.level, v_below.xp_required
      using errcode = 'check_violation';
  end if;

  if v_above.level is not null and new.xp_required >= v_above.xp_required then
    raise exception 'Level % needs less XP than level % (%).',
      new.level, v_above.level, v_above.xp_required
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_level_thresholds_validate
before insert or update on public.level_thresholds
for each row execute function public.fn_validate_level_threshold();

-- ---------------------------------------------------------------------
-- 3. fn_compute_level: read the table instead of a hardcoded formula
-- ---------------------------------------------------------------------
-- STABLE, not IMMUTABLE: it now reads mutable table data, so keeping the
-- old IMMUTABLE marker on a function whose result depends on table
-- contents would be quietly wrong (the planner is allowed to cache an
-- IMMUTABLE function's result across statements), not just a stale
-- comment. Anything above the highest seeded level stays at that level
-- until an admin adds more.
create or replace function public.fn_compute_level(p_total_xp integer)
returns integer
language sql
stable
as $$
  select coalesce(max(level), 1)
    from public.level_thresholds
   where xp_required <= p_total_xp;
$$;

-- ---------------------------------------------------------------------
-- 4. One-time backfill
-- ---------------------------------------------------------------------
-- Existing rows were computed under the old formula and wouldn't
-- self-correct until their next XP event otherwise.
update public.user_stats set level = public.fn_compute_level(total_xp);

-- ---------------------------------------------------------------------
-- 5. Lesson-completion XP award
-- ---------------------------------------------------------------------
-- A NEW, separate SECURITY DEFINER trigger function — deliberately not a
-- modification of fn_update_lessons_completed (the counter bump); the two
-- stay independent. Same completion-transition condition as that one.
--
--  - gamification_enabled = false on the lesson's course: no XP at all.
--  - amount = lessons.xp_reward if NOT NULL (an explicit 0 is a real "no
--    XP" decision, not "unset" — only NULL falls back to
--    courses.default_lesson_xp).
--  - amount <= 0: no transaction at all. A 0-amount xp_transactions row
--    would still run fn_process_xp_transaction (bumping the streak and
--    re-evaluating badges) for an award that's supposed to be a no-op,
--    and would burn the dedupe slot.
--  - Dedupe via uq_xp_transactions_dedupe. That index is PARTIAL (WHERE
--    source_id IS NOT NULL), so ON CONFLICT inference needs the matching
--    predicate — a bare column list fails with "no unique or exclusion
--    constraint matching the ON CONFLICT specification".
--
-- KNOWN GAP (see state.md/rules.md, deliberately not fixed here): the
-- existing fn_update_lessons_completed counter bump and its badge
-- evaluation are NOT gated on gamification_enabled. A course with
-- gamification_enabled = false therefore still increments
-- user_stats.lessons_completed and can still unlock
-- lessons_completed/course_complete badges — it just never awards XP.
create or replace function public.fn_award_lesson_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gamification_enabled boolean;
  v_amount int;
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    select c.gamification_enabled, coalesce(l.xp_reward, c.default_lesson_xp)
      into v_gamification_enabled, v_amount
      from public.lessons l
      join public.courses c on c.id = l.course_id
     where l.id = new.lesson_id;

    if not found or not v_gamification_enabled or v_amount is null or v_amount <= 0 then
      return new;
    end if;

    insert into public.xp_transactions (user_id, amount, reason, source_type, source_id)
    values (new.user_id, v_amount, 'Lesson completed', 'lesson', new.lesson_id)
    on conflict (user_id, source_type, source_id) where source_id is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_lesson_progress_award_xp
after insert or update on public.lesson_progress
for each row execute function public.fn_award_lesson_xp();
