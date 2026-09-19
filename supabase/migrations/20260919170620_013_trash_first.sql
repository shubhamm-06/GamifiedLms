-- =====================================================================
-- Gamified LMS — Migration 013: trash-first deletion
--
-- Adds soft-delete (deleted_at / deleted_by) to courses, modules,
-- lessons, games, badges and profiles. An admin "delete" becomes "move to
-- trash"; a real DELETE is only permitted on a row that is already
-- trashed (RLS-enforced for the five content tables, Edge-Function-enforced
-- for profiles — there is deliberately NO delete trigger on profiles, so
-- the SQL test-account cleanup in rules.md keeps working).
--
-- Trashing a parent hides its children implicitly (policies, views and
-- functions filter through the parent); child rows are never mass-marked.
--
-- UNIQUE CONSTRAINTS CHANGED (a trashed row must not block its own slug):
--   courses_slug_key  -> uq_courses_slug_live  (unique (slug) where deleted_at is null)
--   games_slug_key    -> uq_games_slug_live    (unique (slug) where deleted_at is null)
--   badges_slug_key   -> uq_badges_slug_live   (unique (slug) where deleted_at is null)
-- UNCHANGED ON PURPOSE: profiles_email_key. A trashed user is only banned,
-- not deleted, so auth.users still holds the email; a partial index on
-- profiles.email would gain nothing.
-- No other unique constraint in scope (modules and lessons have none).
-- Restoring a trashed row whose slug has since been reused fails with
-- SQLSTATE 23505 (the client already maps 23505 to a friendly message).
--
-- No FK cascade behaviour is changed. The new deleted_by FKs are
-- ON DELETE SET NULL so a trashed row never blocks deleting the admin
-- who trashed it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns and partial indexes
-- ---------------------------------------------------------------------
alter table public.courses
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;
alter table public.modules
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;
alter table public.lessons
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;
alter table public.games
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;
alter table public.badges
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;
alter table public.profiles
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete set null;

create index idx_courses_deleted_at  on public.courses  (deleted_at) where deleted_at is not null;
create index idx_modules_deleted_at  on public.modules  (deleted_at) where deleted_at is not null;
create index idx_lessons_deleted_at  on public.lessons  (deleted_at) where deleted_at is not null;
create index idx_games_deleted_at    on public.games    (deleted_at) where deleted_at is not null;
create index idx_badges_deleted_at   on public.badges   (deleted_at) where deleted_at is not null;
create index idx_profiles_deleted_at on public.profiles (deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------
-- 2. Slug uniqueness only among live rows
-- ---------------------------------------------------------------------
alter table public.courses drop constraint courses_slug_key;
create unique index uq_courses_slug_live on public.courses (slug) where deleted_at is null;

alter table public.games drop constraint games_slug_key;
create unique index uq_games_slug_live on public.games (slug) where deleted_at is null;

alter table public.badges drop constraint badges_slug_key;
create unique index uq_badges_slug_live on public.badges (slug) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 3. "Is this still live?" helpers
-- SECURITY DEFINER on purpose: RLS policies call these on behalf of a
-- student, and a student cannot SELECT the trashed parent row they need to
-- check — a plain subquery would see nothing and wrongly report "live".
-- ---------------------------------------------------------------------
create or replace function public.fn_user_is_trashed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and deleted_at is not null
  );
$$;

create or replace function public.fn_course_is_live(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses where id = p_course_id and deleted_at is null
  );
$$;

-- A lesson is live when it, its course, and its module (if any) are all
-- not trashed. Trashing a module/course does not touch the lesson row.
create or replace function public.fn_lesson_is_live(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    left join public.modules m on m.id = l.module_id
    where l.id = p_lesson_id
      and l.deleted_at is null
      and c.deleted_at is null
      and (l.module_id is null or m.deleted_at is null)
  );
$$;

-- A trashed admin loses admin powers immediately, even with a token that
-- has not expired yet.
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------
-- 4. deleted_by stamping and the profiles trash-column guard
-- "Client" = the request role is authenticated/anon (or the session user
-- is). service_role, migrations, execute_sql and the SQL test-account
-- cleanup are NOT clients.
-- ---------------------------------------------------------------------
create or replace function public.fn_stamp_deleted_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client boolean :=
    coalesce(auth.role(), '') in ('authenticated', 'anon')
    or current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    -- A client can never create a row that is already trashed, or forge who
    -- trashed it.
    if v_client then
      new.deleted_at := null;
      new.deleted_by := null;
    elsif new.deleted_at is null then
      new.deleted_by := null;
    end if;
    return new;
  end if;

  if new.deleted_at is null then
    -- Live (or just restored): nobody "deleted" it.
    new.deleted_by := null;
  elsif old.deleted_at is null then
    -- Being trashed now. A client's value is always overwritten with the
    -- verified caller; service_role may supply the acting admin explicitly
    -- (the Edge Function does, for profiles).
    if v_client or new.deleted_by is null then
      new.deleted_by := auth.uid();
    end if;
  elsif v_client then
    -- Already trashed and being edited: a client cannot rewrite who did it.
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;

create trigger trg_courses_stamp_deleted_by  before insert or update on public.courses
  for each row execute function public.fn_stamp_deleted_by();
create trigger trg_modules_stamp_deleted_by  before insert or update on public.modules
  for each row execute function public.fn_stamp_deleted_by();
create trigger trg_lessons_stamp_deleted_by  before insert or update on public.lessons
  for each row execute function public.fn_stamp_deleted_by();
create trigger trg_games_stamp_deleted_by    before insert or update on public.games
  for each row execute function public.fn_stamp_deleted_by();
create trigger trg_badges_stamp_deleted_by   before insert or update on public.badges
  for each row execute function public.fn_stamp_deleted_by();
-- Trigger names sort alphabetically: guard_trash_columns < prevent_role_change
-- < stamp_deleted_by, so the guard sees the raw client-supplied values.
create trigger trg_profiles_stamp_deleted_by before insert or update on public.profiles
  for each row execute function public.fn_stamp_deleted_by();

-- profiles has two client-writable UPDATE policies (self and admin), so
-- without this an admin could PATCH deleted_at directly and skip every
-- Edge Function guard (self / primary admin / last admin) and the auth ban.
create or replace function public.fn_guard_profile_trash_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (coalesce(auth.role(), '') in ('authenticated', 'anon')
      or current_user in ('authenticated', 'anon'))
     and (new.deleted_at is distinct from old.deleted_at
          or new.deleted_by is distinct from old.deleted_by)
  then
    raise exception 'profiles.deleted_at and deleted_by can only be changed through the admin-user-management Edge Function'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard_trash_columns before update on public.profiles
  for each row execute function public.fn_guard_profile_trash_columns();

-- ---------------------------------------------------------------------
-- 5. Counters
-- ---------------------------------------------------------------------
-- total_lessons: counts live lessons (draft + published, as before) — not
-- trashed, and not under a trashed module. Recompute-based because a
-- module trash/restore moves many lessons at once. It only writes when the
-- value changes, so a lesson reorder does not bump courses.updated_at.
create or replace function public.fn_recompute_course_lesson_count(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses c
     set total_lessons = x.n
    from (
      select count(*)::int as n
      from public.lessons l
      left join public.modules m on m.id = l.module_id
      where l.course_id = p_course_id
        and l.deleted_at is null
        and (l.module_id is null or m.deleted_at is null)
    ) x
   where c.id = p_course_id
     and c.total_lessons is distinct from x.n;
end;
$$;

revoke execute on function public.fn_recompute_course_lesson_count(uuid) from public, anon, authenticated;

create or replace function public.fn_update_course_lesson_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.fn_recompute_course_lesson_count(new.course_id);
  elsif tg_op = 'DELETE' then
    perform public.fn_recompute_course_lesson_count(old.course_id);
  else
    perform public.fn_recompute_course_lesson_count(new.course_id);
    if old.course_id is distinct from new.course_id then
      perform public.fn_recompute_course_lesson_count(old.course_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger trg_lessons_lesson_count on public.lessons;
create trigger trg_lessons_lesson_count
after insert or delete or update of deleted_at, module_id, course_id on public.lessons
for each row execute function public.fn_update_course_lesson_count();

create or replace function public.fn_module_trash_lesson_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is distinct from new.deleted_at then
    perform public.fn_recompute_course_lesson_count(new.course_id);
  end if;
  return new;
end;
$$;

create trigger trg_modules_lesson_count
after update of deleted_at on public.modules
for each row execute function public.fn_module_trash_lesson_count();

-- total_students: an enrollment "counts" when status = 'active' (unchanged —
-- expiry still decrements) AND its user is not trashed. Still incremental,
-- driven by transitions of that predicate.
create or replace function public.fn_update_course_student_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_counted boolean := false;
  v_new_counted boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_counted := old.status = 'active' and not public.fn_user_is_trashed(old.user_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_counted := new.status = 'active' and not public.fn_user_is_trashed(new.user_id);
  end if;

  if tg_op = 'INSERT' then
    if v_new_counted then
      update public.courses set total_students = total_students + 1 where id = new.course_id;
    end if;
  elsif tg_op = 'DELETE' then
    if v_old_counted then
      update public.courses set total_students = greatest(total_students - 1, 0) where id = old.course_id;
    end if;
  else
    if v_old_counted and not v_new_counted then
      update public.courses set total_students = greatest(total_students - 1, 0) where id = new.course_id;
    elsif not v_old_counted and v_new_counted then
      update public.courses set total_students = total_students + 1 where id = new.course_id;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- Trashing / restoring a user moves every course they are actively enrolled
-- in by one.
create or replace function public.fn_profile_trash_student_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.deleted_at is null) = (new.deleted_at is null) then
    return new;
  end if;

  if new.deleted_at is not null then
    update public.courses c
       set total_students = greatest(c.total_students - x.n, 0)
      from (
        select course_id, count(*)::int as n
        from public.enrollments
        where user_id = new.id and status = 'active'
        group by course_id
      ) x
     where c.id = x.course_id;
  else
    update public.courses c
       set total_students = c.total_students + x.n
      from (
        select course_id, count(*)::int as n
        from public.enrollments
        where user_id = new.id and status = 'active'
        group by course_id
      ) x
     where c.id = x.course_id;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_student_count
after update of deleted_at on public.profiles
for each row execute function public.fn_profile_trash_student_count();

-- ---------------------------------------------------------------------
-- 6. Gamification functions skip trashed content
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
      -- Only live courses count, and only live published lessons must be
      -- complete (trashed lessons / lessons under a trashed module are
      -- excluded from the denominator).
      select count(*) into v_courses_completed
      from public.enrollments e
      join public.courses c on c.id = e.course_id and c.deleted_at is null
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
    -- The extra predicates make a trashed lesson (or one under a trashed
    -- module / course) "not found", which returns below: no XP.
    select c.gamification_enabled, coalesce(l.xp_reward, c.default_lesson_xp)
      into v_gamification_enabled, v_amount
      from public.lessons l
      join public.courses c on c.id = l.course_id
      left join public.modules m on m.id = l.module_id
     where l.id = new.lesson_id
       and l.deleted_at is null
       and c.deleted_at is null
       and (l.module_id is null or m.deleted_at is null);

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

-- Same "completed transition" condition as before; a trashed lesson no
-- longer bumps lessons_completed. (Still not gated on gamification_enabled
-- and still not deduped on re-completion — see state.md.)
create or replace function public.fn_update_lessons_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed')
     and public.fn_lesson_is_live(new.lesson_id)
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

-- ---------------------------------------------------------------------
-- 7. RLS: non-admin SELECT branches exclude trashed rows and rows under
--    trashed parents; admins still see everything (the Trash page needs
--    it). The five *_admin_delete policies now require a trashed row.
-- ---------------------------------------------------------------------
drop policy courses_select_published_or_admin on public.courses;
create policy courses_select_published_or_admin on public.courses
  for select using (
    (status = 'published' and deleted_at is null) or public.fn_is_admin()
  );

drop policy courses_admin_delete on public.courses;
create policy courses_admin_delete on public.courses
  for delete using (public.fn_is_admin() and deleted_at is not null);

drop policy modules_select_enrolled_or_admin on public.modules;
create policy modules_select_enrolled_or_admin on public.modules
  for select using (
    public.fn_is_admin()
    or (
      modules.deleted_at is null
      and public.fn_course_is_live(modules.course_id)
      and exists (
        select 1 from public.enrollments e
        where e.course_id = modules.course_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  );

drop policy modules_admin_delete on public.modules;
create policy modules_admin_delete on public.modules
  for delete using (public.fn_is_admin() and deleted_at is not null);

drop policy lessons_select_enrolled_or_preview_or_admin on public.lessons;
create policy lessons_select_enrolled_or_preview_or_admin on public.lessons
  for select using (
    public.fn_is_admin()
    or (
      public.fn_lesson_is_live(lessons.id)
      and (
        is_preview
        or exists (
          select 1 from public.enrollments e
          where e.course_id = lessons.course_id and e.user_id = auth.uid() and e.status = 'active'
        )
      )
    )
  );

drop policy lessons_admin_delete on public.lessons;
create policy lessons_admin_delete on public.lessons
  for delete using (public.fn_is_admin() and deleted_at is not null);

drop policy games_select_authenticated on public.games;
create policy games_select_authenticated on public.games
  for select using (
    (auth.role() = 'authenticated' and deleted_at is null) or public.fn_is_admin()
  );

drop policy games_admin_delete on public.games;
create policy games_admin_delete on public.games
  for delete using (public.fn_is_admin() and deleted_at is not null);

drop policy badges_select_authenticated on public.badges;
create policy badges_select_authenticated on public.badges
  for select using (
    (auth.role() = 'authenticated' and deleted_at is null) or public.fn_is_admin()
  );

drop policy badges_admin_delete on public.badges;
create policy badges_admin_delete on public.badges
  for delete using (public.fn_is_admin() and deleted_at is not null);

-- profiles: a trashed user can no longer read or edit their own row.
drop policy profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select using (
    (auth.uid() = id and deleted_at is null) or public.fn_is_admin()
  );

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (auth.uid() = id and deleted_at is null)
  with check (auth.uid() = id and deleted_at is null);

-- Leaderboard tables stay world-readable, minus trashed users.
drop policy user_stats_select_public on public.user_stats;
create policy user_stats_select_public on public.user_stats
  for select using (not public.fn_user_is_trashed(user_id) or public.fn_is_admin());

drop policy user_badges_select_public on public.user_badges;
create policy user_badges_select_public on public.user_badges
  for select using (not public.fn_user_is_trashed(user_id) or public.fn_is_admin());

-- ---------------------------------------------------------------------
-- 8. Views (same columns as before; existing grants are kept by
--    CREATE OR REPLACE)
-- ---------------------------------------------------------------------
create or replace view public.profiles_public as
select id, display_name, avatar_url
from public.profiles
where deleted_at is null;

create or replace view public.lesson_effective_xp as
select l.id as lesson_id, coalesce(l.xp_reward, c.default_lesson_xp) as effective_xp
from public.lessons l
join public.courses c on c.id = l.course_id
where public.fn_lesson_is_live(l.id);

create or replace view public.quiz_questions_public as
select qq.id, qq.lesson_id, qq.prompt, qq.options, qq.explanation, qq."position"
from public.quiz_questions qq
join public.lessons l on l.id = qq.lesson_id
where public.fn_is_admin()
   or (
     public.fn_lesson_is_live(l.id)
     and (
       l.is_preview
       or exists (
         select 1 from public.enrollments e
         where e.course_id = l.course_id and e.user_id = auth.uid() and e.status = 'active'
       )
     )
   );

-- ---------------------------------------------------------------------
-- 9. Admin RPCs (SECURITY INVOKER: they run under the caller's own RLS,
--    with an explicit admin check on top)
-- ---------------------------------------------------------------------

-- What still references this course. The DB itself would refuse a course
-- delete on the first four (NO ACTION FKs); the fifth (lesson-sourced XP)
-- has no FK and is an app-level rule.
create or replace function public.fn_course_delete_blockers(p_course_id uuid)
returns table (
  enrollment_count bigint,
  payment_count bigint,
  lesson_progress_count bigint,
  quiz_attempt_count bigint,
  xp_transaction_count bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.fn_is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.enrollments en where en.course_id = p_course_id),
    (select count(*) from public.payments pa where pa.course_id = p_course_id),
    (select count(*) from public.lesson_progress lp
      where lp.course_id = p_course_id
         or lp.lesson_id in (select id from public.lessons where course_id = p_course_id)),
    (select count(*) from public.quiz_attempts qa
      where qa.lesson_id in (select id from public.lessons where course_id = p_course_id)),
    (select count(*) from public.xp_transactions xt
      where xt.source_type = 'lesson'
        and xt.source_id in (select id from public.lessons where course_id = p_course_id));
end;
$$;

-- Permanent module delete that does not resurrect its lessons. The FK is
-- unchanged (lessons.module_id ON DELETE SET NULL), so the lessons WILL
-- lose their module; this first trashes the ones that are still live so
-- they land in Trash (as Ungrouped, restorable) instead of reappearing.
-- Lessons already trashed on their own stay trashed. Returns how many
-- lessons it moved to trash. deleted_by is stamped from auth.uid().
create or replace function public.fn_delete_module_permanently(p_module_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_deleted_at timestamptz;
  v_moved integer;
begin
  if not public.fn_is_admin() then
    raise exception 'Only an admin can permanently delete a module' using errcode = '42501';
  end if;

  select deleted_at into v_deleted_at from public.modules where id = p_module_id;
  if not found then
    raise exception 'Module not found' using errcode = 'P0002';
  end if;
  if v_deleted_at is null then
    raise exception 'A module must be in the trash before it can be permanently deleted'
      using errcode = '55000';
  end if;

  update public.lessons
     set deleted_at = now()
   where module_id = p_module_id and deleted_at is null;
  get diagnostics v_moved = row_count;

  delete from public.modules where id = p_module_id;
  return v_moved;
end;
$$;

-- Why can't this trashed module/lesson be restored? Returns the trashed
-- ancestor(s), course first. Empty = nothing blocks it (also for types that
-- have no parent).
create or replace function public.fn_restore_blockers(p_type text, p_id uuid)
returns table (blocking_type text, blocking_id uuid, blocking_title text)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.fn_is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_type = 'module' then
    return query
      select 'course'::text, c.id, c.title
      from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = p_id and c.deleted_at is not null;
  elsif p_type = 'lesson' then
    return query
      select 'course'::text, c.id, c.title
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = p_id and c.deleted_at is not null
      union all
      select 'module'::text, m.id, m.title
      from public.lessons l
      join public.modules m on m.id = l.module_id
      where l.id = p_id and m.deleted_at is not null;
  end if;
end;
$$;

revoke execute on function public.fn_course_delete_blockers(uuid) from public, anon;
revoke execute on function public.fn_delete_module_permanently(uuid) from public, anon;
revoke execute on function public.fn_restore_blockers(text, uuid) from public, anon;

-- ---------------------------------------------------------------------
-- 10. Session revocation for a trashed user. supabase-js has no
--     revoke-by-user-id call, so the Edge Function calls this instead.
--     service_role only; empty search_path, fully-qualified names.
-- ---------------------------------------------------------------------
create or replace function public.fn_revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;

revoke execute on function public.fn_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.fn_revoke_user_sessions(uuid) to service_role;
