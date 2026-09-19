-- =====================================================================
-- Gamified LMS — Migration 014: close the trashed-user token gap
--
-- Migration 013 bans a trashed user, revokes their sessions and hides
-- their profile, but an access token issued before the trash stays valid
-- until it expires, and every policy that is only "own rows" kept working
-- for it (observed: a trashed user's old token could read its own
-- enrollments and update its own lesson_progress). This adds
--   not public.fn_user_is_trashed(auth.uid())
-- (the existing SECURITY DEFINER helper) to every policy that grants
-- access by auth.uid().
--
-- POLICIES CHANGED (each keeps its name, command and role scope):
--   own-row tables
--     enrollments_select_self            SELECT
--     lesson_progress_select_self        SELECT
--     lesson_progress_insert_self        INSERT (with check)
--     lesson_progress_update_self        UPDATE (using + with check)
--     quiz_attempts_select_self          SELECT
--     xp_transactions_select_self        SELECT
--     payments_select_self               SELECT   (own-row read; no payment
--                                                  logic or write path touched)
--   leaderboard tables (public readers, minus trashed callers)
--     user_stats_select_public           SELECT
--     user_badges_select_public          SELECT
--   enrollment-derived content access
--     modules_select_enrolled_or_admin           SELECT (enrolled leg)
--     lessons_select_enrolled_or_preview_or_admin SELECT (enrolled leg)
--   any-authenticated reads
--     games_select_authenticated         SELECT
--     badges_select_authenticated        SELECT
--   view
--     quiz_questions_public              enrolled leg
--
-- NOT CHANGED, on purpose: profiles_select_self_or_admin and
-- profiles_update_self (already gated in 013); every admin policy
-- (fn_is_admin() already requires a non-trashed profile); world-readable
-- config (courses published, app_settings, level_thresholds, currencies is
-- admin-only); profiles_public / lesson_effective_xp (display data, no
-- per-user access); *_service_role_* policies.
--
-- Also: EXECUTE revoked from public, anon and authenticated on the two 013
-- trigger functions the security advisor flagged. Trigger functions are
-- checked for EXECUTE only when the trigger is created, so this cannot
-- affect firing. The three RLS helpers stay executable (policies evaluate
-- them as the caller).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Own-row tables
-- ---------------------------------------------------------------------
drop policy enrollments_select_self on public.enrollments;
create policy enrollments_select_self on public.enrollments
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

drop policy lesson_progress_select_self on public.lesson_progress;
create policy lesson_progress_select_self on public.lesson_progress
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

drop policy lesson_progress_insert_self on public.lesson_progress;
create policy lesson_progress_insert_self on public.lesson_progress
  for insert with check (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

drop policy lesson_progress_update_self on public.lesson_progress;
create policy lesson_progress_update_self on public.lesson_progress
  for update
  using (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()))
  with check (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid()));

drop policy quiz_attempts_select_self on public.quiz_attempts;
create policy quiz_attempts_select_self on public.quiz_attempts
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

drop policy xp_transactions_select_self on public.xp_transactions;
create policy xp_transactions_select_self on public.xp_transactions
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

drop policy payments_select_self on public.payments;
create policy payments_select_self on public.payments
  for select using (
    (auth.uid() = user_id and not public.fn_user_is_trashed(auth.uid())) or public.fn_is_admin()
  );

-- ---------------------------------------------------------------------
-- Leaderboard tables: hide trashed users' rows (013) and hide the rows from
-- a trashed caller too. anon has auth.uid() = null, which is not trashed.
-- ---------------------------------------------------------------------
drop policy user_stats_select_public on public.user_stats;
create policy user_stats_select_public on public.user_stats
  for select using (
    (not public.fn_user_is_trashed(user_id) and not public.fn_user_is_trashed(auth.uid()))
    or public.fn_is_admin()
  );

drop policy user_badges_select_public on public.user_badges;
create policy user_badges_select_public on public.user_badges
  for select using (
    (not public.fn_user_is_trashed(user_id) and not public.fn_user_is_trashed(auth.uid()))
    or public.fn_is_admin()
  );

-- ---------------------------------------------------------------------
-- Enrollment-derived content access: a trashed user must not keep reading
-- the lessons they were enrolled in on an old token.
-- ---------------------------------------------------------------------
drop policy modules_select_enrolled_or_admin on public.modules;
create policy modules_select_enrolled_or_admin on public.modules
  for select using (
    public.fn_is_admin()
    or (
      modules.deleted_at is null
      and public.fn_course_is_live(modules.course_id)
      and not public.fn_user_is_trashed(auth.uid())
      and exists (
        select 1 from public.enrollments e
        where e.course_id = modules.course_id and e.user_id = auth.uid() and e.status = 'active'
      )
    )
  );

drop policy lessons_select_enrolled_or_preview_or_admin on public.lessons;
create policy lessons_select_enrolled_or_preview_or_admin on public.lessons
  for select using (
    public.fn_is_admin()
    or (
      public.fn_lesson_is_live(lessons.id)
      and (
        is_preview
        or (
          not public.fn_user_is_trashed(auth.uid())
          and exists (
            select 1 from public.enrollments e
            where e.course_id = lessons.course_id and e.user_id = auth.uid() and e.status = 'active'
          )
        )
      )
    )
  );

create or replace view public.quiz_questions_public as
select qq.id, qq.lesson_id, qq.prompt, qq.options, qq.explanation, qq."position"
from public.quiz_questions qq
join public.lessons l on l.id = qq.lesson_id
where public.fn_is_admin()
   or (
     public.fn_lesson_is_live(l.id)
     and (
       l.is_preview
       or (
         not public.fn_user_is_trashed(auth.uid())
         and exists (
           select 1 from public.enrollments e
           where e.course_id = l.course_id and e.user_id = auth.uid() and e.status = 'active'
         )
       )
     )
   );

-- ---------------------------------------------------------------------
-- Any-authenticated reads
-- ---------------------------------------------------------------------
drop policy games_select_authenticated on public.games;
create policy games_select_authenticated on public.games
  for select using (
    (auth.role() = 'authenticated' and deleted_at is null and not public.fn_user_is_trashed(auth.uid()))
    or public.fn_is_admin()
  );

drop policy badges_select_authenticated on public.badges;
create policy badges_select_authenticated on public.badges
  for select using (
    (auth.role() = 'authenticated' and deleted_at is null and not public.fn_user_is_trashed(auth.uid()))
    or public.fn_is_admin()
  );

-- ---------------------------------------------------------------------
-- Advisor follow-up: the two 013 trigger functions never need to be
-- callable through the API.
-- ---------------------------------------------------------------------
revoke execute on function public.fn_module_trash_lesson_count() from public, anon, authenticated;
revoke execute on function public.fn_profile_trash_student_count() from public, anon, authenticated;
