-- =====================================================================
-- Gamified LMS — Migration 017: the server-side lesson engine
--
-- GOAL: lesson completion, active-time tracking, quiz grading, unlock order
-- and XP all happen in the database. A student's browser can no longer write
-- lesson_progress (the old *_insert_self / *_update_self policies let a
-- student set status = 'completed' and earn XP through the existing trigger).
-- This enforces lessons.min_time_seconds and lessons.pass_percentage
-- (migration 015).
--
-- 1. lesson_progress gains active_seconds, first_opened_at, last_heartbeat_at.
-- 2. The student write policies on lesson_progress are dropped, and INSERT /
--    UPDATE / DELETE / TRUNCATE are revoked from anon + authenticated on
--    lesson_progress and quiz_attempts (defense in depth: RLS already denied
--    quiz_attempts writes). Admins have no write policy on either table and
--    the admin UI / Edge Function only read them, so nothing admin changes.
-- 3. Four public SECURITY DEFINER functions are the ONLY student write path
--    (execute: authenticated only; the user always comes from auth.uid()):
--      fn_lesson_heartbeat(p_lesson_id)
--      fn_complete_lesson(p_lesson_id)
--      fn_submit_quiz(p_lesson_id, p_answers jsonb)
--      fn_course_lesson_states(p_course_id)
-- 4. Internal helpers (execute revoked from everyone but the owner /
--    service_role) so the four cannot drift apart:
--      fn_engine_error(code)         raises a machine-readable error
--      fn_is_enrolled(user, course)  THE enrollment predicate
--      fn_lesson_states(user, course) THE sequence + lock-state computation
--      fn_lesson_unlocked_for(user, lesson)
--      fn_engine_guard(lesson)       the shared precondition checks
--      fn_engine_complete(...)       the one place a lesson becomes completed
-- 5. quiz_questions_public and lesson_effective_xp are recreated so they only
--    show what a student may see; quiz_questions_public no longer exposes
--    `explanation`.
--
-- ENROLLMENT RULE (mirrors lessons_select_enrolled_or_preview_or_admin
-- exactly): an enrollments row for (user, course) with status = 'active'.
-- It does NOT look at expires_at and does NOT look at course status, and
-- nothing in the database ever sets status = 'expired' — that gap is
-- recorded in docs/state.md, not changed here. It lives in fn_is_enrolled
-- only, so a later change is a one-line edit.
--
-- SEQUENCE ("course order") — one row per lesson that is: not trashed, in a
-- course that is not trashed and is 'published' or 'archived' (a 'draft'
-- course has no sequence), lesson status = 'published', and either
-- ungrouped or in a topic that is not trashed. Order: lessons in topics first
-- by (topic position, topic created_at, topic id) then (lesson position,
-- created_at, id); UNGROUPED lessons (module_id is null) sort AFTER every
-- topic, by (position, created_at, id). Trashed and unpublished lessons are
-- skipped: they are not in the sequence, so they neither lock nor unlock
-- anything.
--
-- STATE: 'completed' if the student's lesson_progress row is completed; else
-- 'locked' unless EVERY earlier lesson in the sequence is completed (so the
-- first lesson is always unlocked, and the first lesson of a topic unlocks
-- when the previous topic is fully complete); else 'in_progress' if the
-- student has started it (heartbeat, attempt or an in_progress row); else
-- 'available'. For normal progress "all earlier lessons completed" is the
-- same as "the previous lesson is completed"; it also holds if an admin
-- inserts or reorders lessons after students have progressed.
--
-- ERRORS: every refusal is raised with SQLSTATE P0001 and the code as BOTH
-- the message and the hint: not_enrolled (also: no session, trashed user),
-- lesson_unavailable (no such lesson, trashed lesson/topic/course,
-- unpublished, draft course, or a quiz with no questions, or a non-quiz sent
-- to fn_submit_quiz), locked, too_early, quiz_not_passed, invalid_answers,
-- internal_error (anything unexpected; the detail is logged server-side).
--
-- HEARTBEAT: first beat, or a beat more than 30 s after the last, only sets
-- last_heartbeat_at. A beat within 30 s adds least(floor(elapsed seconds), 15)
-- — whole seconds only, so credited time can never exceed real elapsed time
-- (fractions are dropped, never rounded up), and hammering the endpoint adds
-- no more than the wall clock. Completed lessons are returned unchanged.
--
-- QUIZ (v1 assumption, revisit later): the result carries per-question
-- correct/incorrect flags and the score, and NEVER the correct option or the
-- explanation. Answers are {"<question uuid>": "<option id>"} and must cover
-- exactly the lesson's questions.
--
-- IDEMPOTENT / RETRY-SAFE: heartbeat is bounded by wall-clock time; complete
-- returns success without a second XP award (fn_award_lesson_xp keys on the
-- transition into 'completed' and uq_xp_transactions_dedupe backs it); a
-- retried quiz submit only records another attempt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.lesson_progress
  add column active_seconds integer not null default 0,
  add column first_opened_at timestamptz,
  add column last_heartbeat_at timestamptz;

alter table public.lesson_progress
  add constraint lesson_progress_active_seconds_check check (active_seconds >= 0);

-- ---------------------------------------------------------------------
-- 2. No client writes to progress or attempts
-- ---------------------------------------------------------------------
drop policy if exists lesson_progress_insert_self on public.lesson_progress;
drop policy if exists lesson_progress_update_self on public.lesson_progress;

revoke insert, update, delete, truncate on public.lesson_progress from anon, authenticated;
revoke insert, update, delete, truncate on public.quiz_attempts from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Internal helpers
-- ---------------------------------------------------------------------
create or replace function public.fn_engine_error(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, hint = p_code;
end;
$$;

create or replace function public.fn_is_enrolled(p_user_id uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.user_id = p_user_id
      and e.course_id = p_course_id
      and e.status = 'active'
  );
$$;

create or replace function public.fn_lesson_states(p_user_id uuid, p_course_id uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  sort_index integer,
  state text,
  active_seconds integer,
  min_time_seconds integer,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with seq as (
    select l.id as lesson_id,
           l.module_id,
           l.min_time_seconds,
           row_number() over (
             order by (l.module_id is null), m.position, m.created_at, m.id,
                      l.position, l.created_at, l.id
           ) as sort_index
    from public.lessons l
    join public.courses c on c.id = l.course_id
    left join public.modules m on m.id = l.module_id
    where l.course_id = p_course_id
      and l.deleted_at is null
      and l.status = 'published'
      and c.deleted_at is null
      and c.status in ('published', 'archived')
      and (l.module_id is null or m.deleted_at is null)
  ),
  joined as (
    select s.lesson_id, s.module_id, s.sort_index, s.min_time_seconds,
           lp.status as progress_status,
           lp.first_opened_at,
           coalesce(lp.active_seconds, 0) as active_seconds,
           lp.completed_at,
           coalesce(lp.status = 'completed', false) as is_done
    from seq s
    left join public.lesson_progress lp
           on lp.user_id = p_user_id and lp.lesson_id = s.lesson_id
  ),
  flagged as (
    select j.*,
           coalesce(
             bool_and(j.is_done) over (
               order by j.sort_index rows between unbounded preceding and 1 preceding
             ),
             true
           ) as earlier_all_done
    from joined j
  )
  select f.lesson_id,
         f.module_id,
         f.sort_index::integer,
         case
           when f.is_done then 'completed'
           when not f.earlier_all_done then 'locked'
           when f.progress_status = 'in_progress'
             or f.first_opened_at is not null
             or f.active_seconds > 0 then 'in_progress'
           else 'available'
         end,
         f.active_seconds,
         f.min_time_seconds,
         f.completed_at
  from flagged f
  order by f.sort_index;
end;
$$;

create or replace function public.fn_lesson_unlocked_for(p_user_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.state <> 'locked'
      from public.lessons l
      cross join lateral public.fn_lesson_states(p_user_id, l.course_id) s
      where l.id = p_lesson_id
        and s.lesson_id = l.id
        and public.fn_is_enrolled(p_user_id, l.course_id)
    ),
    false
  );
$$;

create or replace function public.fn_engine_guard(p_lesson_id uuid)
returns table (
  user_id uuid,
  course_id uuid,
  content_type text,
  min_time_seconds integer,
  pass_percentage integer,
  state text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_course uuid;
  v_type text;
  v_min integer;
  v_pass integer;
  v_state text;
begin
  if v_uid is null or public.fn_user_is_trashed(v_uid) then
    perform public.fn_engine_error('not_enrolled');
  end if;

  select l.course_id, l.content_type, l.min_time_seconds, l.pass_percentage
    into v_course, v_type, v_min, v_pass
    from public.lessons l
   where l.id = p_lesson_id;
  if not found then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  if not public.fn_is_enrolled(v_uid, v_course) then
    perform public.fn_engine_error('not_enrolled');
  end if;

  -- Membership in the sequence IS the "live and published" check.
  select s.state into v_state
    from public.fn_lesson_states(v_uid, v_course) s
   where s.lesson_id = p_lesson_id;
  if not found then
    perform public.fn_engine_error('lesson_unavailable');
  end if;
  if v_state = 'locked' then
    perform public.fn_engine_error('locked');
  end if;

  return query select v_uid, v_course, v_type, v_min, v_pass, v_state;
end;
$$;

-- The one place a lesson becomes completed. The existing AFTER INSERT/UPDATE
-- triggers on lesson_progress (fn_award_lesson_xp, fn_update_lessons_completed)
-- then run in this same transaction: XP, stats, badges. Nothing is
-- reimplemented here.
create or replace function public.fn_engine_complete(
  p_user_id uuid,
  p_lesson_id uuid,
  p_course_id uuid
)
returns table (was_new boolean, completed_at timestamptz, xp_awarded integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.lesson_progress%rowtype;
  v_xp integer;
begin
  insert into public.lesson_progress (user_id, lesson_id, course_id, status, first_opened_at)
  values (p_user_id, p_lesson_id, p_course_id, 'in_progress', now())
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row
    from public.lesson_progress lp
   where lp.user_id = p_user_id and lp.lesson_id = p_lesson_id
     for update;

  if v_row.status = 'completed' then
    return query select false, v_row.completed_at, 0;
    return;
  end if;

  update public.lesson_progress lp
     set status = 'completed',
         completed_at = now(),
         progress_percent = 100,
         first_opened_at = coalesce(lp.first_opened_at, now()),
         updated_at = now()
   where lp.id = v_row.id;

  select coalesce(sum(x.amount), 0)::integer into v_xp
    from public.xp_transactions x
   where x.user_id = p_user_id
     and x.source_type = 'lesson'
     and x.source_id = p_lesson_id;

  return query select true, now(), v_xp;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. The four public functions
-- ---------------------------------------------------------------------
create or replace function public.fn_lesson_heartbeat(p_lesson_id uuid)
returns table (
  active_seconds integer,
  min_time_seconds integer,
  time_met boolean,
  completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g record;
  v_row public.lesson_progress%rowtype;
  v_elapsed integer;
  v_active integer;
begin
  select * into g from public.fn_engine_guard(p_lesson_id);

  insert into public.lesson_progress (user_id, lesson_id, course_id, status, first_opened_at)
  values (g.user_id, p_lesson_id, g.course_id, 'in_progress', now())
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row
    from public.lesson_progress lp
   where lp.user_id = g.user_id and lp.lesson_id = p_lesson_id
     for update;

  if v_row.status = 'completed' then
    return query select v_row.active_seconds, g.min_time_seconds,
                        v_row.active_seconds >= g.min_time_seconds, true;
    return;
  end if;

  if v_row.last_heartbeat_at is not null
     and now() - v_row.last_heartbeat_at <= interval '30 seconds' then
    v_elapsed := greatest(
      least(floor(extract(epoch from (now() - v_row.last_heartbeat_at)))::integer, 15),
      0
    );
  else
    v_elapsed := 0;
  end if;

  update public.lesson_progress lp
     set active_seconds = lp.active_seconds + v_elapsed,
         last_heartbeat_at = now(),
         first_opened_at = coalesce(lp.first_opened_at, now()),
         status = 'in_progress',
         updated_at = now()
   where lp.id = v_row.id
  returning lp.active_seconds into v_active;

  return query select v_active, g.min_time_seconds, v_active >= g.min_time_seconds, false;
exception
  when raise_exception then
    raise;
  when others then
    raise log 'fn_lesson_heartbeat failed: % %', sqlstate, sqlerrm;
    perform public.fn_engine_error('internal_error');
end;
$$;

create or replace function public.fn_complete_lesson(p_lesson_id uuid)
returns table (
  completed boolean,
  already_completed boolean,
  completed_at timestamptz,
  xp_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g record;
  v_row public.lesson_progress%rowtype;
  v_new record;
begin
  select * into g from public.fn_engine_guard(p_lesson_id);

  select * into v_row
    from public.lesson_progress lp
   where lp.user_id = g.user_id and lp.lesson_id = p_lesson_id;

  if found and v_row.status = 'completed' then
    return query select true, true, v_row.completed_at, 0;
    return;
  end if;

  if coalesce(v_row.active_seconds, 0) < g.min_time_seconds then
    perform public.fn_engine_error('too_early');
  end if;

  if g.content_type = 'quiz'
     and not exists (
       select 1 from public.quiz_attempts qa
        where qa.user_id = g.user_id and qa.lesson_id = p_lesson_id and qa.passed
     ) then
    perform public.fn_engine_error('quiz_not_passed');
  end if;

  select * into v_new from public.fn_engine_complete(g.user_id, p_lesson_id, g.course_id);
  return query select true, not v_new.was_new, v_new.completed_at, v_new.xp_awarded;
exception
  when raise_exception then
    raise;
  when others then
    raise log 'fn_complete_lesson failed: % %', sqlstate, sqlerrm;
    perform public.fn_engine_error('internal_error');
end;
$$;

create or replace function public.fn_submit_quiz(p_lesson_id uuid, p_answers jsonb)
returns table (
  score integer,
  max_score integer,
  percentage integer,
  passed boolean,
  results jsonb,
  completed boolean,
  time_met boolean,
  xp_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g record;
  q record;
  v_total integer;
  v_score integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_answer text;
  v_options text[];
  v_is_correct boolean;
  v_passed boolean;
  v_row public.lesson_progress%rowtype;
  v_time_met boolean := false;
  v_completed boolean := false;
  v_xp integer := 0;
  v_new record;
begin
  select * into g from public.fn_engine_guard(p_lesson_id);

  if g.content_type <> 'quiz' then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  select count(*) into v_total from public.quiz_questions qq where qq.lesson_id = p_lesson_id;
  if v_total = 0 then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  -- The answers must be an object covering exactly this lesson's questions.
  if p_answers is null
     or jsonb_typeof(p_answers) <> 'object'
     or (select count(*) from jsonb_object_keys(p_answers)) <> v_total then
    perform public.fn_engine_error('invalid_answers');
  end if;

  for q in
    select qq.id, qq.options, qq.correct_option
      from public.quiz_questions qq
     where qq.lesson_id = p_lesson_id
     order by qq."position", qq.id
  loop
    if not (p_answers ? q.id::text)
       or jsonb_typeof(p_answers -> q.id::text) <> 'string' then
      perform public.fn_engine_error('invalid_answers');
    end if;
    v_answer := p_answers ->> q.id::text;

    -- An option is {"id","text"}; a bare string is its own id (legacy shape,
    -- tolerated by the admin UI's parseOptions too).
    if jsonb_typeof(q.options) <> 'array' then
      perform public.fn_engine_error('lesson_unavailable');
    end if;
    select array_agg(case when jsonb_typeof(o) = 'object' then o ->> 'id' else o #>> '{}' end)
      into v_options
      from jsonb_array_elements(q.options) o;
    if v_options is null or not (v_answer = any (v_options)) then
      perform public.fn_engine_error('invalid_answers');
    end if;

    v_is_correct := (v_answer = q.correct_option);
    if v_is_correct then
      v_score := v_score + 1;
    end if;
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('question_id', q.id, 'correct', v_is_correct)
    );
  end loop;

  -- passed <=> score/total >= pass_percentage/100, in integers (no rounding).
  v_passed := (v_score * 100) >= (g.pass_percentage * v_total);

  insert into public.quiz_attempts (user_id, lesson_id, score, max_score, passed, answers)
  values (g.user_id, p_lesson_id, v_score, v_total, v_passed, p_answers);

  insert into public.lesson_progress (user_id, lesson_id, course_id, status, first_opened_at)
  values (g.user_id, p_lesson_id, g.course_id, 'in_progress', now())
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row
    from public.lesson_progress lp
   where lp.user_id = g.user_id and lp.lesson_id = p_lesson_id
     for update;

  v_time_met := v_row.active_seconds >= g.min_time_seconds;
  v_completed := (v_row.status = 'completed');

  if v_row.status <> 'completed' then
    update public.lesson_progress lp
       set first_opened_at = coalesce(lp.first_opened_at, now()),
           status = 'in_progress',
           updated_at = now()
     where lp.id = v_row.id;

    if v_passed and v_time_met then
      select * into v_new from public.fn_engine_complete(g.user_id, p_lesson_id, g.course_id);
      v_completed := true;
      v_xp := v_new.xp_awarded;
    end if;
  end if;

  return query select v_score, v_total, (v_score * 100) / v_total, v_passed,
                      v_results, v_completed, v_time_met, v_xp;
exception
  when raise_exception then
    raise;
  when others then
    raise log 'fn_submit_quiz failed: % %', sqlstate, sqlerrm;
    perform public.fn_engine_error('internal_error');
end;
$$;

create or replace function public.fn_course_lesson_states(p_course_id uuid)
returns table (
  lesson_id uuid,
  module_id uuid,
  state text,
  active_seconds integer,
  min_time_seconds integer,
  completed_at timestamptz,
  sort_index integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.fn_user_is_trashed(v_uid) then
    perform public.fn_engine_error('not_enrolled');
  end if;
  if not public.fn_is_enrolled(v_uid, p_course_id) then
    perform public.fn_engine_error('not_enrolled');
  end if;
  if not exists (
    select 1 from public.courses c
     where c.id = p_course_id and c.deleted_at is null and c.status in ('published', 'archived')
  ) then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  return query
    select s.lesson_id, s.module_id, s.state, s.active_seconds, s.min_time_seconds,
           s.completed_at, s.sort_index
      from public.fn_lesson_states(v_uid, p_course_id) s
     order by s.sort_index;
exception
  when raise_exception then
    raise;
  when others then
    raise log 'fn_course_lesson_states failed: % %', sqlstate, sqlerrm;
    perform public.fn_engine_error('internal_error');
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Privileges: helpers internal, the four public functions authenticated only
-- ---------------------------------------------------------------------
revoke all on function public.fn_engine_error(text) from public, anon, authenticated;
revoke all on function public.fn_is_enrolled(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_lesson_states(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_lesson_unlocked_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_engine_guard(uuid) from public, anon, authenticated;
revoke all on function public.fn_engine_complete(uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.fn_lesson_heartbeat(uuid) from public, anon, authenticated;
revoke all on function public.fn_complete_lesson(uuid) from public, anon, authenticated;
revoke all on function public.fn_submit_quiz(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fn_course_lesson_states(uuid) from public, anon, authenticated;

grant execute on function public.fn_lesson_heartbeat(uuid) to authenticated;
grant execute on function public.fn_complete_lesson(uuid) to authenticated;
grant execute on function public.fn_submit_quiz(uuid, jsonb) to authenticated;
grant execute on function public.fn_course_lesson_states(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Views: show a student only what a student may see
--
-- NOTE: the two view definitions below are what 017 applied, and they were
-- BROKEN for every signed-in user ("permission denied for function
-- fn_lesson_unlocked_for" / "fn_is_enrolled": a view checks EXECUTE against
-- the calling role, and this migration had revoked it). Migration 018
-- replaces both views with caller-only wrappers. Left as applied for history.
-- ---------------------------------------------------------------------
-- quiz_questions_public: DROP + CREATE (a column is removed, which CREATE OR
-- REPLACE cannot do). `explanation` is gone (it can give the answer away);
-- correct_option was never in it. Rows: everything for an admin; otherwise a
-- published, live lesson that is a preview, or one the student is enrolled in
-- AND has unlocked. Still SECURITY DEFINER (owner privileges): quiz_questions
-- is admin-only and RLS cannot hide a single column, so a plain invoker view
-- would show a student nothing.
drop view public.quiz_questions_public;

create view public.quiz_questions_public as
select qq.id,
       qq.lesson_id,
       qq.prompt,
       qq.options,
       qq."position"
  from public.quiz_questions qq
  join public.lessons l on l.id = qq.lesson_id
 where public.fn_is_admin()
    or (
      public.fn_lesson_is_live(l.id)
      and l.status = 'published'
      and (
        l.is_preview
        or (
          not public.fn_user_is_trashed(auth.uid())
          and public.fn_lesson_unlocked_for(auth.uid(), l.id)
        )
      )
    );

-- Views get Supabase's default ALL privileges on creation (migration 016).
revoke all on public.quiz_questions_public from anon, authenticated;
grant select on public.quiz_questions_public to authenticated;

-- lesson_effective_xp: same columns, so CREATE OR REPLACE keeps its grants.
-- Rows now follow the lessons SELECT policy (admin, preview, or enrolled)
-- instead of listing every live lesson to everyone.
create or replace view public.lesson_effective_xp as
select l.id as lesson_id,
       coalesce(l.xp_reward, c.default_lesson_xp) as effective_xp
  from public.lessons l
  join public.courses c on c.id = l.course_id
 where public.fn_lesson_is_live(l.id)
   and (
     public.fn_is_admin()
     or l.is_preview
     or (
       not public.fn_user_is_trashed(auth.uid())
       and public.fn_is_enrolled(auth.uid(), l.course_id)
     )
   );
