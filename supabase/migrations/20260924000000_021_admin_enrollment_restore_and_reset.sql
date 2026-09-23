-- =====================================================================
-- 021: Admin "Restore access" + "Reset progress" (/admin/users/$userId)
--
-- Two admin-only capabilities on the Enrollments section of a user's
-- detail page, plus the one schema change each of them needed.
--
-- 1. RESTORE ACCESS is a NEW enrollment row, not an edit of the revoked
--    one: the revoked row stays untouched as history. `uq_enrollments_
--    user_course` (UNIQUE (user_id, course_id)) made that impossible, so
--    it is replaced by a PARTIAL unique index that only constrains ACTIVE
--    rows. A (user, course) pair may now hold at most one active
--    enrollment and any number of revoked/expired historical ones.
--
--    Side effect, deliberate: `fn_create_manual_order` catches
--    `unique_violation` and refuses a second order for the same pair. A
--    revoked student could therefore never be re-ordered OR re-enrolled
--    by any path; now they can, because the old row no longer collides.
--
-- 2. RESET PROGRESS removes the user's progress for ONE course and claws
--    back the XP that course granted, as a single atomic admin-only RPC.
--    The compensating entry is ONE negative `'manual'` row, and the
--    original per-lesson `('lesson', lesson_id)` rows are DELETED rather
--    than offset. That is forced by the once-only XP guard:
--    `uq_xp_transactions_dedupe` is UNIQUE (user_id, source_type,
--    source_id) WHERE source_id IS NOT NULL, and `fn_award_lesson_xp`
--    inserts with ON CONFLICT DO NOTHING. Keeping the positives would
--    (a) block a negative row on the same key and (b) silently award 0 XP
--    when the lesson is completed again. Deleting them keeps re-earning
--    working without touching the guard itself. The audit trail survives
--    as the aggregate negative row (course title, amount, admin).
--
-- Streaks and badges are NOT touched, and XP never goes below zero -- see
-- the comments inside `fn_admin_reset_course_progress`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. One ACTIVE enrollment per (user, course); history is unconstrained
-- ---------------------------------------------------------------------
alter table public.enrollments
  drop constraint uq_enrollments_user_course;

create unique index uq_enrollments_user_course_active
  on public.enrollments (user_id, course_id)
  where status = 'active';

comment on index public.uq_enrollments_user_course_active is
  'At most one ACTIVE enrollment per (user, course). Revoked and expired rows are history and are deliberately unconstrained, so "Restore access" can insert a fresh row without destroying the old one (migration 021).';

-- ---------------------------------------------------------------------
-- 2. Preview: exactly what a reset would remove
--
-- The dialog must show the real numbers before the admin confirms, and
-- they must match what the reset actually does -- so both read the same
-- definition from the same place rather than the UI re-deriving it.
-- ---------------------------------------------------------------------
create or replace function public.fn_admin_course_progress_summary(
  p_user_id uuid,
  p_course_id uuid
)
returns table (
  lessons_completed integer,
  progress_rows integer,
  quiz_attempts integer,
  xp_to_claw_back integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson_ids uuid[];
begin
  if not public.fn_is_admin() then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  -- Every lesson of the course, trashed and draft included: a reset is total.
  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_lesson_ids
    from public.lessons l
   where l.course_id = p_course_id;

  return query
  select
    (select count(*)::integer from public.lesson_progress lp
      where lp.user_id = p_user_id and lp.course_id = p_course_id and lp.status = 'completed'),
    (select count(*)::integer from public.lesson_progress lp
      where lp.user_id = p_user_id and lp.course_id = p_course_id),
    (select count(*)::integer from public.quiz_attempts qa
      where qa.user_id = p_user_id and qa.lesson_id = any(v_lesson_ids)),
    (select coalesce(sum(x.amount), 0)::integer from public.xp_transactions x
      where x.user_id = p_user_id and x.source_type = 'lesson' and x.source_id = any(v_lesson_ids));
end;
$$;

revoke all on function public.fn_admin_course_progress_summary(uuid, uuid) from public, anon;
grant execute on function public.fn_admin_course_progress_summary(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. The reset itself: one transaction, admin-only, returns real counts
-- ---------------------------------------------------------------------
create or replace function public.fn_admin_reset_course_progress(
  p_user_id uuid,
  p_course_id uuid
)
returns table (
  lessons_removed integer,
  quiz_attempts_removed integer,
  xp_clawed_back integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_ids uuid[];
  v_progress_removed integer;
  v_completed_removed integer;
  v_attempts_removed integer;
  v_xp_total integer;
  v_clawback integer;
  v_course_title text;
  v_stats public.user_stats%rowtype;
begin
  -- The whole point of the function: the caller is checked HERE, inside a
  -- SECURITY DEFINER body, not in the UI. EXECUTE is granted to
  -- `authenticated`, so a non-admin can call it and gets this exception.
  if not public.fn_is_admin() then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_lesson_ids
    from public.lessons l
   where l.course_id = p_course_id;

  select c.title into v_course_title from public.courses c where c.id = p_course_id;

  -- 1. Progress and attempts, this course only.
  delete from public.quiz_attempts
   where user_id = p_user_id and lesson_id = any(v_lesson_ids);
  get diagnostics v_attempts_removed = row_count;

  select count(*)::integer into v_completed_removed
    from public.lesson_progress
   where user_id = p_user_id and course_id = p_course_id and status = 'completed';

  delete from public.lesson_progress
   where user_id = p_user_id and course_id = p_course_id;
  get diagnostics v_progress_removed = row_count;

  -- 2. The XP this course's lessons granted, then remove those ledger rows.
  --    Deleting them is what lets the lessons be earned again later: the
  --    dedupe index keys on (user_id, source_type, source_id) and
  --    `fn_award_lesson_xp` skips silently on conflict (see header).
  select coalesce(sum(amount), 0)::integer into v_xp_total
    from public.xp_transactions
   where user_id = p_user_id and source_type = 'lesson' and source_id = any(v_lesson_ids);

  delete from public.xp_transactions
   where user_id = p_user_id and source_type = 'lesson' and source_id = any(v_lesson_ids);

  select * into v_stats from public.user_stats where user_id = p_user_id for update;

  -- Never below zero: a clawback larger than the balance (possible once an
  -- admin has removed XP by other means) is capped at what is actually there.
  v_clawback := least(v_xp_total, coalesce(v_stats.total_xp, 0));

  if v_clawback > 0 then
    -- The compensating row goes through `fn_process_xp_transaction`, which
    -- already handles a negative amount and recomputes `level` via
    -- `fn_compute_level` -- that math is reused, never duplicated here.
    insert into public.xp_transactions (user_id, amount, reason, source_type, source_id)
    values (
      p_user_id,
      -v_clawback,
      'Progress reset by an admin: ' || coalesce(v_course_title, 'course'),
      'manual',
      null
    );

    -- ...but that same trigger also advances current_streak / longest_streak /
    -- last_activity_date on every insert, and a reset must not touch streaks.
    -- Restore the snapshot taken above, in this same transaction.
    update public.user_stats
       set current_streak = v_stats.current_streak,
           longest_streak = v_stats.longest_streak,
           last_activity_date = v_stats.last_activity_date
     where user_id = p_user_id;
  end if;

  -- `lessons_completed` is only ever incremented (by
  -- `fn_update_lessons_completed`, on INSERT/UPDATE to 'completed'); deleting
  -- the rows leaves it inflated, and it feeds badge evaluation. Bring it down
  -- by what was actually removed, floored at zero.
  if v_completed_removed > 0 then
    update public.user_stats
       set lessons_completed = greatest(lessons_completed - v_completed_removed, 0)
     where user_id = p_user_id;
  end if;

  -- Badges are deliberately left alone: `fn_evaluate_badges` only ever
  -- inserts, so nothing already unlocked is revoked by any of the above.

  return query select v_progress_removed, v_attempts_removed, v_clawback;
end;
$$;

revoke all on function public.fn_admin_reset_course_progress(uuid, uuid) from public, anon;
grant execute on function public.fn_admin_reset_course_progress(uuid, uuid) to authenticated;
