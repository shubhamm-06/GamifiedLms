-- =====================================================================
-- Gamified LMS — Migration 016: lock the three public views
--
-- FOUND (2026-09-20, during the view audit for the lesson engine): the
-- views public.profiles_public, public.quiz_questions_public and
-- public.lesson_effective_xp were granted ALL privileges to both `anon`
-- and `authenticated` (Supabase's default privileges on new objects in
-- `public`), and they are owned by `postgres`, which bypasses RLS.
--
-- profiles_public is a single-table view, so PostgreSQL treats it as
-- auto-updatable. A write through a view is checked against the VIEW
-- OWNER'S privileges, not the caller's, so RLS on public.profiles did not
-- apply. Verified against the live project with fixture users:
--   * `PATCH /rest/v1/profiles_public?id=eq.<uid>` with only the anon key
--     changed another user's display_name (HTTP 200);
--   * the same call with a signed-in student's JWT did too;
--   * the same update on the `profiles` TABLE was refused by RLS;
--   * `DELETE /rest/v1/profiles_public?id=eq.<uid>` as a student deleted
--     that user's profile row.
-- The other two views are joins, so PostgreSQL does not make them
-- auto-updatable; their write grants were dead weight, not a live hole.
--
-- FIX: revoke everything from anon and authenticated on all three, then
-- give SELECT back to authenticated only.
--   * No write path exists through these views for anyone; the app never
--     wrote through them (nothing in src/ or the Edge Function reads or
--     writes them).
--   * anon loses SELECT too: profiles_public would otherwise let a
--     logged-out visitor list every user's id, display name and avatar.
--     Nothing anonymous reads any of the three (no logged-out screen
--     exists). If a logged-out preview is built later, grant SELECT then.
--   * service_role and postgres are untouched.
--
-- LEFT ALONE, on purpose: the base tables keep Supabase's default table
-- privileges (their protection is RLS, which applies to direct table
-- access). Any NEW view in `public` inherits the same default ALL
-- privileges, so a new view must revoke write privileges when it is
-- created — see docs/rules.md.
-- =====================================================================

revoke all on public.profiles_public from anon, authenticated;
revoke all on public.quiz_questions_public from anon, authenticated;
revoke all on public.lesson_effective_xp from anon, authenticated;

grant select on public.profiles_public to authenticated;
grant select on public.quiz_questions_public to authenticated;
grant select on public.lesson_effective_xp to authenticated;
