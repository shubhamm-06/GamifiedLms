-- =====================================================================
-- 025: Game lessons complete through the game, and their XP is the game's
-- score, clamped on the server.
--
-- A game lesson hosts a page the admin registered in `games` (bundle_url).
-- The page reports a score to the app with postMessage; the app sends it to
-- ONE new function, and nothing the client says is trusted:
--
--   fn_complete_game(p_lesson_id uuid, p_score numeric)
--     -> (completed, already_completed, completed_at, xp_awarded)
--
--   * Same door as the rest of the engine: SECURITY DEFINER, search_path '',
--     user from auth.uid(), `fn_engine_guard` (enrolled, live, published,
--     unlocked), EXECUTE for `authenticated` only.
--   * The lesson must be a game lesson whose game exists and is not trashed.
--   * The score must be a number that is not NaN and not negative
--     (`invalid_score`); anything else, however large, is CLAMPED, never
--     honoured: XP = least(floor(score), games.max_xp).
--   * The lesson's minimum time still applies (`too_early`), like every type.
--   * XP is once per lesson and only on the first completion: an already
--     completed lesson returns success with 0 XP and inserts nothing. The
--     XP row is inserted in the same transaction, BEFORE the lesson is
--     completed, as an ordinary `xp_transactions` row (source_type 'lesson',
--     source_id = the lesson, so the existing dedupe index, the admin
--     progress reset's claw-back and `fn_engine_complete`'s XP sum all cover
--     it), so the existing rollup trigger (`fn_process_xp_transaction`: level,
--     streak, badges) runs unchanged. Nothing is reimplemented client-side.
--   * A course with gamification off awards nothing (as for every type).
--
-- Two existing functions change so the lesson-XP trigger cannot pay twice or
-- pay the wrong amount for a game:
--   * `fn_award_lesson_xp` (trigger) now skips a game lesson whose game
--     exists: its XP is `fn_complete_game`'s. Every other lesson is untouched,
--     and a game lesson whose game row is missing or trashed keeps the old
--     rule (lesson XP on completion).
--   * `fn_complete_lesson` now refuses such a game lesson (`lesson_unavailable`),
--     so the timer path cannot complete it for the default lesson XP. Such a
--     lesson is completed only by `fn_complete_game`.
-- =====================================================================

create or replace function public.fn_award_lesson_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gamification_enabled boolean;
  v_amount int;
  v_type text;
  v_game_id uuid;
begin
  if new.status = 'completed' and (old.status is null or old.status <> 'completed') then
    select c.gamification_enabled, coalesce(l.xp_reward, c.default_lesson_xp), l.content_type, l.game_id
      into v_gamification_enabled, v_amount, v_type, v_game_id
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

    -- A game lesson with a live game is paid by fn_complete_game (the clamped score).
    if v_type = 'game' and exists (
         select 1 from public.games g where g.id = v_game_id and g.deleted_at is null
       ) then
      return new;
    end if;

    insert into public.xp_transactions (user_id, amount, reason, source_type, source_id)
    values (new.user_id, v_amount, 'Lesson completed', 'lesson', new.lesson_id)
    on conflict (user_id, source_type, source_id) where source_id is not null do nothing;
  end if;
  return new;
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

  -- A game lesson with a live game is completed by the game, through fn_complete_game.
  if g.content_type = 'game' and exists (
       select 1
         from public.lessons l
         join public.games gm on gm.id = l.game_id
        where l.id = p_lesson_id and gm.deleted_at is null
     ) then
    perform public.fn_engine_error('lesson_unavailable');
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

create or replace function public.fn_complete_game(p_lesson_id uuid, p_score numeric)
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
  v_max integer;
  v_gamified boolean;
  v_row public.lesson_progress%rowtype;
  v_amount integer := 0;
  v_new record;
begin
  select * into g from public.fn_engine_guard(p_lesson_id);

  if g.content_type <> 'game' then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  select gm.max_xp
    into v_max
    from public.lessons l
    join public.games gm on gm.id = l.game_id
   where l.id = p_lesson_id and gm.deleted_at is null;
  if not found then
    perform public.fn_engine_error('lesson_unavailable');
  end if;

  if p_score is null or p_score = 'NaN'::numeric or p_score < 0 then
    perform public.fn_engine_error('invalid_score');
  end if;

  insert into public.lesson_progress (user_id, lesson_id, course_id, status, first_opened_at)
  values (g.user_id, p_lesson_id, g.course_id, 'in_progress', now())
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row
    from public.lesson_progress lp
   where lp.user_id = g.user_id and lp.lesson_id = p_lesson_id
     for update;

  if v_row.status = 'completed' then
    return query select true, true, v_row.completed_at, 0;
    return;
  end if;

  if coalesce(v_row.active_seconds, 0) < g.min_time_seconds then
    perform public.fn_engine_error('too_early');
  end if;

  select c.gamification_enabled into v_gamified from public.courses c where c.id = g.course_id;

  -- The clamp: whatever the page reported, never more than the game's stored cap.
  v_amount := least(floor(p_score), v_max::numeric)::integer;
  if v_gamified and v_amount > 0 then
    insert into public.xp_transactions (user_id, amount, reason, source_type, source_id)
    values (g.user_id, v_amount, 'Game completed', 'lesson', p_lesson_id)
    on conflict (user_id, source_type, source_id) where source_id is not null do nothing;
  end if;

  select * into v_new from public.fn_engine_complete(g.user_id, p_lesson_id, g.course_id);
  return query select true, not v_new.was_new, v_new.completed_at, v_new.xp_awarded;
exception
  when raise_exception then
    raise;
  when others then
    raise log 'fn_complete_game failed: % %', sqlstate, sqlerrm;
    perform public.fn_engine_error('internal_error');
end;
$$;

revoke all on function public.fn_complete_game(uuid, numeric) from public, anon;
grant execute on function public.fn_complete_game(uuid, numeric) to authenticated;
