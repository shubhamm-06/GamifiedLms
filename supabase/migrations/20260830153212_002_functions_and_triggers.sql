-- =====================================================================
-- Gamified LMS — Migration 002: functions & triggers
-- All rollup-writing functions are SECURITY DEFINER so they can
-- maintain user_stats / courses counters regardless of the calling
-- role's RLS grants (the tables they write to have no client-facing
-- write policies at all — see 003_rls_policies.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin check, used throughout RLS policies
-- ---------------------------------------------------------------------
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- courses.updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.fn_set_updated_at();

-- ---------------------------------------------------------------------
-- courses.total_students maintenance
-- ASSUMPTION: counts enrollments with status = 'active'; decremented on
-- revoke, incremented when a revoked enrollment is reactivated. Expiry
-- (status -> 'expired') does NOT currently decrement — flagging this for
-- your review since the plan doesn't specify whether expired learners
-- still count as "students".
-- ---------------------------------------------------------------------
create or replace function public.fn_update_course_student_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      update public.courses set total_students = total_students + 1 where id = new.course_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'active' then
      update public.courses set total_students = greatest(total_students - 1, 0) where id = old.course_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'active' and new.status <> 'active' then
      update public.courses set total_students = greatest(total_students - 1, 0) where id = new.course_id;
    elsif old.status <> 'active' and new.status = 'active' then
      update public.courses set total_students = total_students + 1 where id = new.course_id;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_enrollments_student_count
after insert or update or delete on public.enrollments
for each row execute function public.fn_update_course_student_count();

-- ---------------------------------------------------------------------
-- courses.total_lessons maintenance
-- ASSUMPTION: counts ALL lessons regardless of status (draft + published).
-- Flag if you want this restricted to status = 'published' only.
-- ---------------------------------------------------------------------
create or replace function public.fn_update_course_lesson_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.courses set total_lessons = total_lessons + 1 where id = new.course_id;
  elsif tg_op = 'DELETE' then
    update public.courses set total_lessons = greatest(total_lessons - 1, 0) where id = old.course_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_lessons_lesson_count
after insert or delete on public.lessons
for each row execute function public.fn_update_course_lesson_count();

-- ---------------------------------------------------------------------
-- Level formula
-- ASSUMPTION: plan states "xp_required = 100 * level^1.5" without saying
-- whether that's cumulative-to-reach-level or a per-level threshold.
-- Implemented here as a per-level threshold (level N unlocks at
-- 100 * N^1.5 total XP). Please confirm this matches intent — the
-- alternative (cumulative sum of thresholds) produces a slower curve.
-- ---------------------------------------------------------------------
create or replace function public.fn_compute_level(p_total_xp int)
returns int
language sql
immutable
as $$
  select greatest(1, floor(power(greatest(p_total_xp, 0)::numeric / 100, 1.0/1.5))::int + 1);
$$;

-- ---------------------------------------------------------------------
-- Badge evaluation — re-runs are harmless due to the unique constraint
-- on user_badges(user_id, badge_id).
-- ---------------------------------------------------------------------
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

  for v_badge in select * from public.badges where is_active loop
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
      select count(*) into v_courses_completed
      from public.enrollments e
      where e.user_id = p_user_id
        and e.status = 'active'
        and not exists (
          select 1 from public.lessons l
          where l.course_id = e.course_id and l.status = 'published'
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

-- ---------------------------------------------------------------------
-- xp_transactions AFTER INSERT — the core rollup trigger
-- ---------------------------------------------------------------------
create or replace function public.fn_process_xp_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_existing public.user_stats%rowtype;
  v_new_total_xp int;
  v_new_streak int;
  v_new_longest int;
begin
  select * into v_existing from public.user_stats where user_id = new.user_id for update;

  if not found then
    v_new_total_xp := new.amount;
    v_new_streak := 1;
    v_new_longest := 1;

    insert into public.user_stats (user_id, total_xp, level, current_streak, longest_streak, last_activity_date, lessons_completed)
    values (new.user_id, v_new_total_xp, public.fn_compute_level(v_new_total_xp), v_new_streak, v_new_longest, v_today, 0);
  else
    v_new_total_xp := v_existing.total_xp + new.amount;

    if v_existing.last_activity_date = v_today then
      v_new_streak := v_existing.current_streak;
    elsif v_existing.last_activity_date = v_today - 1 then
      v_new_streak := v_existing.current_streak + 1;
    else
      v_new_streak := 1;
    end if;

    v_new_longest := greatest(v_existing.longest_streak, v_new_streak);

    update public.user_stats
    set total_xp = v_new_total_xp,
        level = public.fn_compute_level(v_new_total_xp),
        current_streak = v_new_streak,
        longest_streak = v_new_longest,
        last_activity_date = v_today
    where user_id = new.user_id;
  end if;

  perform public.fn_evaluate_badges(new.user_id);

  return new;
end;
$$;

create trigger trg_xp_transactions_process
after insert on public.xp_transactions
for each row execute function public.fn_process_xp_transaction();

-- ---------------------------------------------------------------------
-- lesson_progress -> user_stats.lessons_completed
-- ---------------------------------------------------------------------
create or replace function public.fn_update_lessons_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    insert into public.user_stats (user_id, lessons_completed)
    values (new.user_id, 1)
    on conflict (user_id) do update
      set lessons_completed = public.user_stats.lessons_completed + 1;

    perform public.fn_evaluate_badges(new.user_id);
  end if;
  return new;
end;
$$;

create trigger trg_lesson_progress_completed
after insert or update on public.lesson_progress
for each row execute function public.fn_update_lessons_completed();

-- ---------------------------------------------------------------------
-- profiles.role guard — blocks self-promotion by anyone but service_role
-- ---------------------------------------------------------------------
create or replace function public.fn_prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'role cannot be changed by client';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_change
before update on public.profiles
for each row execute function public.fn_prevent_role_change();
