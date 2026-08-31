-- =====================================================================
-- Gamified LMS — Migration 003: RLS policies
-- Mirrors the access matrix in section 9 of the DB plan.
-- Service-role policies are defense-in-depth documentation: the
-- Supabase service_role key already bypasses RLS entirely, but stating
-- the intent explicitly makes the access model self-documenting.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- Full row: self (or admin). Public display fields for everyone else
-- are served via profiles_public (a security-definer view below),
-- since RLS can't restrict individual columns.
-- ---------------------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select using (auth.uid() = id or public.fn_is_admin());

create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create view public.profiles_public as
select id, display_name, avatar_url from public.profiles;

grant select on public.profiles_public to authenticated, anon;

-- ---------------------------------------------------------------------
-- courses — published rows public, drafts admin-only; writes admin-only
-- ---------------------------------------------------------------------
create policy courses_select_published_or_admin on public.courses
  for select using (status = 'published' or public.fn_is_admin());

create policy courses_admin_insert on public.courses
  for insert with check (public.fn_is_admin());

create policy courses_admin_update on public.courses
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy courses_admin_delete on public.courses
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- modules — enrolled users or admin; writes admin-only
-- ---------------------------------------------------------------------
create policy modules_select_enrolled_or_admin on public.modules
  for select using (
    public.fn_is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.course_id = modules.course_id and e.user_id = auth.uid() and e.status = 'active'
    )
  );

create policy modules_admin_insert on public.modules
  for insert with check (public.fn_is_admin());

create policy modules_admin_update on public.modules
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy modules_admin_delete on public.modules
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- lessons — enrolled users, plus is_preview lessons; writes admin-only
-- ---------------------------------------------------------------------
create policy lessons_select_enrolled_or_preview_or_admin on public.lessons
  for select using (
    is_preview
    or public.fn_is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.course_id = lessons.course_id and e.user_id = auth.uid() and e.status = 'active'
    )
  );

create policy lessons_admin_insert on public.lessons
  for insert with check (public.fn_is_admin());

create policy lessons_admin_update on public.lessons
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy lessons_admin_delete on public.lessons
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- games — any authenticated user reads; writes admin-only
-- ---------------------------------------------------------------------
create policy games_select_authenticated on public.games
  for select using (auth.role() = 'authenticated' or public.fn_is_admin());

create policy games_admin_insert on public.games
  for insert with check (public.fn_is_admin());

create policy games_admin_update on public.games
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy games_admin_delete on public.games
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- quiz_questions — base table is ADMIN-ONLY (correct_option must never
-- reach a student). Students read via quiz_questions_public instead,
-- which strips correct_option and gates rows to enrolled/preview access.
-- ---------------------------------------------------------------------
create policy quiz_questions_admin_select on public.quiz_questions
  for select using (public.fn_is_admin());

create policy quiz_questions_admin_insert on public.quiz_questions
  for insert with check (public.fn_is_admin());

create policy quiz_questions_admin_update on public.quiz_questions
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy quiz_questions_admin_delete on public.quiz_questions
  for delete using (public.fn_is_admin());

create or replace view public.quiz_questions_public as
select qq.id, qq.lesson_id, qq.prompt, qq.options, qq.explanation, qq.position
from public.quiz_questions qq
join public.lessons l on l.id = qq.lesson_id
where public.fn_is_admin()
   or l.is_preview
   or exists (
     select 1 from public.enrollments e
     where e.course_id = l.course_id and e.user_id = auth.uid() and e.status = 'active'
   );

grant select on public.quiz_questions_public to authenticated;

-- ---------------------------------------------------------------------
-- quiz_attempts — self reads own attempts.
-- ASSUMPTION: insert is restricted to service_role only, i.e. an Edge
-- Function grades the submission server-side and inserts the result —
-- the client never inserts score/passed directly. Flag if you intended
-- "self insert" to mean the client itself can insert (with grading
-- happening in a separate step first).
-- ---------------------------------------------------------------------
create policy quiz_attempts_select_self on public.quiz_attempts
  for select using (auth.uid() = user_id or public.fn_is_admin());

create policy quiz_attempts_service_role_insert on public.quiz_attempts
  for insert with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- enrollments — self reads own rows; all writes server-side
-- ---------------------------------------------------------------------
create policy enrollments_select_self on public.enrollments
  for select using (auth.uid() = user_id or public.fn_is_admin());

create policy enrollments_service_role_insert on public.enrollments
  for insert with check (auth.role() = 'service_role');

create policy enrollments_service_role_update on public.enrollments
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy enrollments_service_role_delete on public.enrollments
  for delete using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- lesson_progress — self reads/upserts own rows only
-- ---------------------------------------------------------------------
create policy lesson_progress_select_self on public.lesson_progress
  for select using (auth.uid() = user_id or public.fn_is_admin());

create policy lesson_progress_insert_self on public.lesson_progress
  for insert with check (auth.uid() = user_id);

create policy lesson_progress_update_self on public.lesson_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- payments — self reads own rows; all writes via webhook/service role
-- ---------------------------------------------------------------------
create policy payments_select_self on public.payments
  for select using (auth.uid() = user_id or public.fn_is_admin());

create policy payments_service_role_insert on public.payments
  for insert with check (auth.role() = 'service_role');

create policy payments_service_role_update on public.payments
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- xp_transactions — self reads own ledger rows; inserts service-role only
-- ---------------------------------------------------------------------
create policy xp_transactions_select_self on public.xp_transactions
  for select using (auth.uid() = user_id or public.fn_is_admin());

create policy xp_transactions_service_role_insert on public.xp_transactions
  for insert with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- user_stats — public read for leaderboards; NO client write policies
-- at all (only the SECURITY DEFINER trigger functions can write).
-- ---------------------------------------------------------------------
create policy user_stats_select_public on public.user_stats
  for select using (true);

-- ---------------------------------------------------------------------
-- badges — any authenticated user reads; writes admin-only
-- ---------------------------------------------------------------------
create policy badges_select_authenticated on public.badges
  for select using (auth.role() = 'authenticated' or public.fn_is_admin());

create policy badges_admin_insert on public.badges
  for insert with check (public.fn_is_admin());

create policy badges_admin_update on public.badges
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy badges_admin_delete on public.badges
  for delete using (public.fn_is_admin());

-- ---------------------------------------------------------------------
-- user_badges — public read for leaderboards; writes service-role only
-- (fn_evaluate_badges is SECURITY DEFINER so it writes regardless)
-- ---------------------------------------------------------------------
create policy user_badges_select_public on public.user_badges
  for select using (true);

create policy user_badges_service_role_insert on public.user_badges
  for insert with check (auth.role() = 'service_role');
