-- =====================================================================
-- Gamified LMS — Migration 018: caller-only helpers for the two gated views
--
-- FINDING (from the real-JWT verification of 017): after 017,
-- quiz_questions_public and lesson_effective_xp returned
--   42501 permission denied for function fn_lesson_unlocked_for / fn_is_enrolled
-- for EVERY signed-in user, admins included. A view runs its table access as
-- the view OWNER, but Postgres checks EXECUTE on the functions it calls
-- against the CALLING role (and does so when the query starts, for every
-- function in the view — not only the ones a row actually evaluates). 017 had
-- revoked EXECUTE on the internal helpers, which take a user id parameter, so
-- the views broke.
--
-- The internal helpers must stay un-callable by clients: with a user id
-- parameter, `fn_is_enrolled(<someone else>, <course>)` would let a student
-- probe other students' enrollments and `fn_lesson_unlocked_for` their
-- progress. So the views get two caller-only wrappers instead. They take NO
-- user parameter — the user is always auth.uid() — so all they can tell a
-- caller is the caller's own status. They add nothing to the write surface.
--
--   fn_caller_enrolled(p_course_id)         caller has an active enrollment
--                                           (false for no session / trashed)
--   fn_caller_lesson_unlocked(p_lesson_id)  caller is enrolled AND the lesson
--                                           is in the sequence and not locked
--
-- Both delegate to the same helpers the four engine functions use, so the
-- views cannot drift from enforcement. The two views are re-created with the
-- same columns (CREATE OR REPLACE keeps their select-only grants from 016).
-- =====================================================================

create or replace function public.fn_caller_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not public.fn_user_is_trashed(auth.uid())
     and public.fn_is_enrolled(auth.uid(), p_course_id);
$$;

create or replace function public.fn_caller_lesson_unlocked(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not public.fn_user_is_trashed(auth.uid())
     and public.fn_lesson_unlocked_for(auth.uid(), p_lesson_id);
$$;

revoke all on function public.fn_caller_enrolled(uuid) from public, anon, authenticated;
revoke all on function public.fn_caller_lesson_unlocked(uuid) from public, anon, authenticated;
grant execute on function public.fn_caller_enrolled(uuid) to authenticated;
grant execute on function public.fn_caller_lesson_unlocked(uuid) to authenticated;

create or replace view public.quiz_questions_public as
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
      and (l.is_preview or public.fn_caller_lesson_unlocked(l.id))
    );

create or replace view public.lesson_effective_xp as
select l.id as lesson_id,
       coalesce(l.xp_reward, c.default_lesson_xp) as effective_xp
  from public.lessons l
  join public.courses c on c.id = l.course_id
 where public.fn_lesson_is_live(l.id)
   and (
     public.fn_is_admin()
     or l.is_preview
     or public.fn_caller_enrolled(l.course_id)
   );
