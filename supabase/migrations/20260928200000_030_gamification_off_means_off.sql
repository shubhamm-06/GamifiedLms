-- =====================================================================
-- 030: A course with gamification_enabled = false produces no XP, no
-- levels, no streak movement, no lessons_completed count and no badges.
--
-- Before this only the XP path checked the flag (fn_award_lesson_xp and
-- fn_complete_game), and XP is also what moves level, streak and
-- last_activity_date (fn_process_xp_transaction runs only when an XP row is
-- inserted), so those three were already right. Two writers ignored the flag:
--   * fn_update_lessons_completed bumped user_stats.lessons_completed and
--     evaluated badges on every completion, flag or no flag;
--   * fn_evaluate_badges counted a finished gamification-off course toward
--     course_complete, on that completion and on every later evaluation (an XP
--     event in a different course re-counts every enrollment).
-- And fn_admin_reset_course_progress decremented lessons_completed by the
-- number of completions it removed even for a course that never counted them,
-- which would have wrongly lowered a counter earned in gamified courses.
--
-- Changes, each the narrowest possible:
--   1. fn_update_lessons_completed: skip silently (no raise, same return, no
--      effect on progress or unlock) when the lesson's course has the flag off.
--      A course row that cannot be resolved is treated as gamified.
--   2. fn_evaluate_badges: only the course_complete join changes, to count
--      gamified courses only.
--   3. fn_admin_reset_course_progress: decrement lessons_completed only when
--      the course CURRENTLY has the flag on (GREATEST(..., 0) as before). The
--      decrement is approximate: nothing records whether the flag was on when
--      each completion happened, so a course flipped mid-way is judged by the
--      flag at reset time.
-- Untouched: fn_process_xp_transaction (it also serves manual admin awards),
-- fn_award_lesson_xp, fn_complete_game (game XP amounts are a separate task),
-- the engine and every RPC signature.
--
-- Not retroactive: nothing here recomputes or deletes existing XP, badges or
-- counters, and badges already earned are never revoked. It only changes what
-- happens from the next completion or evaluation.
-- =====================================================================

create or replace function public.fn_update_lessons_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed')
     and public.fn_lesson_is_live(new.lesson_id)
     and coalesce(
       (select c.gamification_enabled
          from public.lessons l
          join public.courses c on c.id = l.course_id
         where l.id = new.lesson_id),
       true
     )
  then
    insert into public.user_stats (user_id, lessons_completed)
    values (new.user_id, 1)
    on conflict (user_id) do update
      set lessons_completed = public.user_stats.lessons_completed + 1;
    perform public.fn_evaluate_badges(new.user_id);
  end if;
  return new;
end;
$$;

create or replace function public.fn_evaluate_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats public.user_stats%rowtype;
  v_badge record;
  v_courses_completed int;
begin
  select * into v_stats from public.user_stats where user_id = p_user_id;
  if not found then
    return;
  end if;
  for v_badge in
    select * from public.badges where is_active and deleted_at is null
  loop
    if v_badge.condition_type = 'total_xp' and v_stats.total_xp >= v_badge.condition_value then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict (user_id, badge_id) do nothing;
    elsif v_badge.condition_type = 'streak_days' and v_stats.current_streak >= v_badge.condition_value then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict (user_id, badge_id) do nothing;
    elsif v_badge.condition_type = 'lessons_completed' and v_stats.lessons_completed >= v_badge.condition_value then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict (user_id, badge_id) do nothing;
    elsif v_badge.condition_type = 'course_complete' then
      -- Only live, gamified courses count, and only live published lessons must
      -- be complete (trashed lessons / lessons under a trashed module are
      -- excluded from the denominator).
      select count(*) into v_courses_completed
      from public.enrollments e
      join public.courses c on c.id = e.course_id and c.deleted_at is null and c.gamification_enabled
      where e.user_id = p_user_id
        and e.status = 'active'
        and not exists (
          select 1
          from public.lessons l
          left join public.modules m on m.id = l.module_id
          where l.course_id = e.course_id and l.status = 'published'
            and l.deleted_at is null
            and (l.module_id is null or m.deleted_at is null)
            and not exists (
              select 1 from public.lesson_progress lp
              where lp.user_id = p_user_id and lp.lesson_id = l.id and lp.status = 'completed'
            )
        );
      if v_courses_completed >= v_badge.condition_value then
        insert into public.user_badges (user_id, badge_id)
        values (p_user_id, v_badge.id)
        on conflict (user_id, badge_id) do nothing;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.fn_admin_reset_course_progress(p_user_id uuid, p_course_id uuid)
returns table(lessons_removed integer, quiz_attempts_removed integer, xp_clawed_back integer)
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
  if not public.fn_is_admin() then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;
  select coalesce(array_agg(l.id), '{}'::uuid[]) into v_lesson_ids
    from public.lessons l
   where l.course_id = p_course_id;
  select c.title into v_course_title from public.courses c where c.id = p_course_id;
  delete from public.quiz_attempts
   where user_id = p_user_id and lesson_id = any(v_lesson_ids);
  get diagnostics v_attempts_removed = row_count;
  select count(*)::integer into v_completed_removed
    from public.lesson_progress
   where user_id = p_user_id and course_id = p_course_id and status = 'completed';
  delete from public.lesson_progress
   where user_id = p_user_id and course_id = p_course_id;
  get diagnostics v_progress_removed = row_count;
  select coalesce(sum(amount), 0)::integer into v_xp_total
    from public.xp_transactions
   where user_id = p_user_id and source_type = 'lesson' and source_id = any(v_lesson_ids);
  delete from public.xp_transactions
   where user_id = p_user_id and source_type = 'lesson' and source_id = any(v_lesson_ids);
  select * into v_stats from public.user_stats where user_id = p_user_id for update;
  v_clawback := least(v_xp_total, coalesce(v_stats.total_xp, 0));
  if v_clawback > 0 then
    insert into public.xp_transactions (user_id, amount, reason, source_type, source_id)
    values (
      p_user_id,
      -v_clawback,
      'Progress reset by an admin: ' || coalesce(v_course_title, 'course'),
      'manual',
      null
    );
    update public.user_stats
       set current_streak = v_stats.current_streak,
           longest_streak = v_stats.longest_streak,
           last_activity_date = v_stats.last_activity_date
     where user_id = p_user_id;
  end if;
  -- lessons_completed only counts completions in gamified courses, so only a
  -- course that currently has the flag on gives any back (approximate for a
  -- course flipped mid-way: nothing records the flag per completion).
  if v_completed_removed > 0
     and coalesce((select c.gamification_enabled from public.courses c where c.id = p_course_id), true)
  then
    update public.user_stats
       set lessons_completed = greatest(lessons_completed - v_completed_removed, 0)
     where user_id = p_user_id;
  end if;
  return query select v_progress_removed, v_attempts_removed, v_clawback;
end;
$$;
