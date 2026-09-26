-- =====================================================================
-- 024: Per-question quiz feedback, through its own gated path.
--
-- The quiz page now tells a child whether each answer was right at the moment
-- they tap it, and if it was wrong, which option was right. The answer key
-- (`quiz_questions.correct_option`) still reaches no client through any table
-- or view; the ONLY way a student sees it is this function, and only for the
-- question they are answering, in reply to an answer they supply.
--
--   fn_check_quiz_answer(p_lesson_id, p_question_id, p_option_id)
--     -> (correct boolean, correct_option text)
--
-- Same door as the rest of the lesson engine: SECURITY DEFINER, search_path
-- '', the user comes from auth.uid() (never a parameter), the shared
-- `fn_engine_guard` does enrollment / live / published / unlocked checks
-- (so a locked lesson, a lesson in a course the caller is not enrolled in,
-- or a trashed one is refused with the engine's usual codes), and EXECUTE is
-- for `authenticated` only. It writes NOTHING: no attempt, no progress, no XP.
-- Grading, the attempt row, completion and XP stay in `fn_submit_quiz`
-- (migration 017), which the page still calls once, at the end, with every
-- answer; nothing about pass marks or XP-once changes.
--
-- Known and accepted: a client that calls this directly can learn the key by
-- trying options. The product decision (2026-09-26) is to show the right
-- answer after each answer, and a failed quiz is retaken on the same
-- questions, so the key is learnable by design; this function only keeps it
-- off the wire until an answer has been given.
-- =====================================================================

create or replace function public.fn_check_quiz_answer(
  p_lesson_id   uuid,
  p_question_id uuid,
  p_option_id   text
)
returns table (
  correct        boolean,
  correct_option text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g record;
  q record;
  v_options text[];
begin
  select * into g from public.fn_engine_guard(p_lesson_id);

  if g.content_type <> 'quiz' then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  select qq.options, qq.correct_option
    into q
    from public.quiz_questions qq
   where qq.id = p_question_id
     and qq.lesson_id = p_lesson_id;
  if not found or jsonb_typeof(q.options) <> 'array' then
    perform public.fn_engine_error('invalid_answers');
  end if;

  -- An option is {"id","text"}; a bare string is its own id (same rule as fn_submit_quiz).
  select array_agg(case when jsonb_typeof(o) = 'object' then o ->> 'id' else o #>> '{}' end)
    into v_options
    from jsonb_array_elements(q.options) o;
  if p_option_id is null or v_options is null or not (p_option_id = any (v_options)) then
    perform public.fn_engine_error('invalid_answers');
  end if;

  return query select (p_option_id = q.correct_option), q.correct_option;
end;
$$;

revoke all on function public.fn_check_quiz_answer(uuid, uuid, text) from public, anon;
grant execute on function public.fn_check_quiz_answer(uuid, uuid, text) to authenticated;
