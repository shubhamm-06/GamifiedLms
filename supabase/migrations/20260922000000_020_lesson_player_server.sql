-- =====================================================================
-- Gamified LMS: Migration 020 (PROPOSED, NOT APPLIED): server side of the
-- kid lesson player
--
-- STATUS: written for review. Nothing here has been applied. The filename's
-- timestamp is a placeholder; on approval it is applied through the Supabase
-- MCP and this file is renamed to the live version (as for 013 to 019).
--
-- The lesson engine (017 to 019) already provides heartbeat, completion, quiz
-- grading, pass mark per lesson and a safe question read path. Two things the
-- player needs are still missing; each is a separate section so either can be
-- approved on its own.
--
-- A. fn_submit_quiz returns each question's `explanation` inside the graded
--    result (and only there). Today it returns correct/incorrect flags only
--    (docs/rules.md: "Quiz answers never leave the server"). The player must
--    show an explanation AFTER grading. `correct_option` is still never
--    returned. Approving A also amends that rules.md invariant (see the plan).
--
-- B. (optional) fn_lesson_heartbeat stops dropping the fractional second. Today
--    it credits floor(seconds since the last beat) and stamps last_heartbeat_at
--    = now(), so every beat loses up to 1 s (10 s beats were credited 9 or 10).
--    A lesson with a 90 s minimum then takes about 95 s while the child sees
--    "1:30". B advances last_heartbeat_at only by the whole seconds it credited,
--    so nothing is lost and total credit can still never exceed the wall clock.
--
-- No table, column, policy, grant or view changes. Both functions keep their
-- signatures, return types, SECURITY DEFINER, empty search_path and their
-- execute grant (authenticated only): CREATE OR REPLACE preserves privileges.
-- The user is still auth.uid(), never a parameter.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. Explanations after grading
--
-- Change from 017: the loop also selects qq.explanation, and each entry of
-- `results` becomes {question_id, correct, explanation}. `explanation` is null
-- when the admin wrote none. The explanation is read from quiz_questions
-- (admin-only table) inside this definer function, only after the answers have
-- been validated and the attempt has been recorded, and only for the questions
-- of the lesson the caller just submitted an attempt for. It is not returned by
-- quiz_questions_public and there is still no other way to read it.
--
-- To show explanations only for questions answered wrongly, replace
--   q.explanation
-- with
--   case when v_is_correct then null else q.explanation end
-- ---------------------------------------------------------------------
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

  if p_answers is null
     or jsonb_typeof(p_answers) <> 'object'
     or (select count(*) from jsonb_object_keys(p_answers)) <> v_total then
    perform public.fn_engine_error('invalid_answers');
  end if;

  for q in
    select qq.id, qq.options, qq.correct_option, qq.explanation
      from public.quiz_questions qq
     where qq.lesson_id = p_lesson_id
     order by qq."position", qq.id
  loop
    if not (p_answers ? q.id::text)
       or jsonb_typeof(p_answers -> q.id::text) <> 'string' then
      perform public.fn_engine_error('invalid_answers');
    end if;
    v_answer := p_answers ->> q.id::text;

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
      jsonb_build_object(
        'question_id', q.id,
        'correct', v_is_correct,
        'explanation', q.explanation
      )
    );
  end loop;

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

-- ---------------------------------------------------------------------
-- B. (optional) Heartbeat keeps the fractional second
--
-- Change from 017: credit is still least(floor(elapsed), 15) for a beat within
-- 30 s of the previous one, and a first beat or a beat after a gap over 30 s
-- still credits 0 and only restarts the clock. What changes is where the clock
-- restarts:
--   * elapsed <= 15 s: last_heartbeat_at moves forward by exactly the whole
--     seconds credited (so the leftover fraction is credited on a later beat);
--   * elapsed  > 15 s (capped): last_heartbeat_at = now(), the excess is dropped
--     (a pause is never credited, as before).
-- Total credit therefore never exceeds the seconds that really passed, however
-- fast beats arrive (a beat under one second after the last credits 0 and moves
-- nothing), and a replayed or duplicate beat adds nothing.
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
  v_gap double precision;
  v_credit integer := 0;
  v_new_last timestamptz := now();
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
    v_gap := greatest(extract(epoch from (now() - v_row.last_heartbeat_at)), 0);
    v_credit := least(floor(v_gap)::integer, 15);
    if v_gap <= 15 then
      v_new_last := v_row.last_heartbeat_at + make_interval(secs => v_credit);
    end if;
  end if;

  update public.lesson_progress lp
     set active_seconds = lp.active_seconds + v_credit,
         last_heartbeat_at = v_new_last,
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
