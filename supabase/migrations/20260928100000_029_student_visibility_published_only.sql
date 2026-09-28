-- =====================================================================
-- 029: Students reach only published, non-trashed courses and lessons.
--
-- Two rules, both on the student side only (admin branches are unchanged):
--   1. `archived` means unavailable to every student. The engine
--      (fn_lesson_states, fn_course_lesson_states) used to admit
--      ('published', 'archived') while the courses policy admitted only
--      'published', so an enrolled student in an archived course got the
--      "isn't ready" screen by accident of the two disagreeing. Now both
--      agree. Enrollments, progress and XP are not touched: republishing the
--      course brings everything back exactly as it was.
--   2. A draft lesson is never readable by a student, including by a direct
--      table read: lessons_select_enrolled_or_preview_or_admin and the
--      lesson_effective_xp view had no lesson-status check.
--
-- fn_course_is_live / fn_lesson_is_live are NOT changed: they keep meaning
-- "not trashed" and are still used by fn_update_lessons_completed (the stats
-- and badge trigger), whose behaviour must not move. Two new helpers carry
-- the student-visibility meaning instead:
--   fn_course_is_reachable(course)  status = 'published' and not trashed
--   fn_lesson_is_reachable(lesson)  lesson published AND fn_lesson_is_live
--                                   AND its course reachable
-- Same attributes and EXECUTE grants as the helpers they sit beside
-- (SECURITY DEFINER, STABLE, search_path = public; PUBLIC, anon,
-- authenticated, service_role), so policies keep working for anon and
-- authenticated. Grants are not widened.
--
-- Repointed to the new helpers, keeping every existing admin branch, preview
-- rule and unlock rule: the lessons, modules and lesson_content_blocks
-- SELECT policies and the lesson_effective_xp and quiz_questions_public
-- views (CREATE OR REPLACE VIEW keeps their owner, options and grants).
--
-- No new engine error code: an archived course and a draft lesson both end
-- in the existing 'lesson_unavailable'.
-- =====================================================================

create or replace function public.fn_course_is_reachable(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_course_is_live(p_course_id)
     and exists (select 1 from public.courses c where c.id = p_course_id and c.status = 'published');
$$;

create or replace function public.fn_lesson_is_reachable(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select l.status = 'published'
         and public.fn_lesson_is_live(l.id)
         and public.fn_course_is_reachable(l.course_id)
      from public.lessons l
      where l.id = p_lesson_id
    ),
    false
  );
$$;

grant execute on function public.fn_course_is_reachable(uuid) to anon, authenticated, service_role;

grant execute on function public.fn_lesson_is_reachable(uuid) to anon, authenticated, service_role;

drop policy lessons_select_enrolled_or_preview_or_admin on public.lessons;

create policy lessons_select_enrolled_or_preview_or_admin on public.lessons
  for select using (
    fn_is_admin()
    or (
      fn_lesson_is_reachable(id)
      and (
        is_preview
        or (
          not fn_user_is_trashed(auth.uid())
          and exists (
            select 1 from enrollments e
             where e.course_id = lessons.course_id and e.user_id = auth.uid() and e.status = 'active'
          )
        )
      )
    )
  );

drop policy modules_select_enrolled_or_admin on public.modules;

create policy modules_select_enrolled_or_admin on public.modules
  for select using (
    fn_is_admin()
    or (
      deleted_at is null
      and fn_course_is_reachable(course_id)
      and not fn_user_is_trashed(auth.uid())
      and exists (
        select 1 from enrollments e
         where e.course_id = modules.course_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  );

drop policy lesson_content_blocks_select_enrolled_or_preview_or_admin on public.lesson_content_blocks;

create policy lesson_content_blocks_select_enrolled_or_preview_or_admin on public.lesson_content_blocks
  for select using (
    fn_is_admin()
    or (
      fn_lesson_is_reachable(lesson_id)
      and exists (
        select 1 from lessons l
         where l.id = lesson_content_blocks.lesson_id
           and l.status = 'published'
           and (
             l.is_preview
             or (
               not fn_user_is_trashed(auth.uid())
               and exists (
                 select 1 from enrollments e
                  where e.course_id = l.course_id and e.user_id = auth.uid() and e.status = 'active'
               )
             )
           )
      )
    )
  );

create or replace view public.lesson_effective_xp as
  select l.id as lesson_id,
         coalesce(l.xp_reward, c.default_lesson_xp) as effective_xp
    from lessons l
    join courses c on c.id = l.course_id
   where (fn_lesson_is_live(l.id) and fn_is_admin())
      or (fn_lesson_is_reachable(l.id) and (l.is_preview or fn_caller_enrolled(l.course_id)));

create or replace view public.quiz_questions_public as
  select qq.id,
         qq.lesson_id,
         qq.prompt,
         qq.options,
         qq."position"
    from quiz_questions qq
    join lessons l on l.id = qq.lesson_id
   where fn_is_admin()
      or (fn_lesson_is_reachable(l.id) and l.status = 'published' and (l.is_preview or fn_caller_lesson_unlocked(l.id)));

create or replace function public.fn_course_lesson_states(p_course_id uuid)
returns table(lesson_id uuid, module_id uuid, state text, active_seconds integer, min_time_seconds integer, completed_at timestamp with time zone, sort_index integer)
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
     where c.id = p_course_id and c.deleted_at is null and c.status = 'published'
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

create or replace function public.fn_lesson_states(p_user_id uuid, p_course_id uuid)
returns table(lesson_id uuid, module_id uuid, sort_index integer, state text, active_seconds integer, min_time_seconds integer, completed_at timestamp with time zone)
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
      and c.status = 'published'
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
