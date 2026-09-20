-- =====================================================================
-- Gamified LMS — Migration 015: admin-configurable lesson and game settings
--
-- ADDS (storage only — NOTHING ENFORCES ANY OF THESE YET):
--   lessons.min_time_seconds  integer not null default 90
--       CHECK between 0 and 3600. Whole seconds a kid should spend on a
--       lesson before "Mark complete" is offered. 0 = no minimum time.
--   lessons.pass_percentage   integer not null default 60
--       CHECK between 1 and 100. Percent a kid must score to pass a quiz.
--       Meaningful only for content_type = 'quiz'; stored (and ignored) for
--       every other type. The quiz IS the lesson (quiz_questions.lesson_id
--       -> lessons.id), so the setting lives on lessons.
--   games.orientation         text not null default 'any'
--       CHECK in ('portrait','landscape','any'). The orientation a game is
--       meant to be played in.
--
-- The kid-side completion function that will read and enforce
-- min_time_seconds and pass_percentage does not exist yet. Until it does,
-- these columns are settings an admin can edit and nothing more.
--
-- BACKFILL: existing quiz lessons are set to min_time_seconds = 0; every
-- other existing lesson keeps the column default of 90. The UPDATE lists
-- only min_time_seconds, so it fires none of the lesson triggers that are
-- scoped to other columns (trg_lessons_lesson_count is
-- UPDATE OF deleted_at, module_id, course_id).
--
-- POLICIES: none added or changed. The existing lessons_admin_update and
-- games_admin_update (fn_is_admin()) already cover any column, and there
-- is no student write policy on either table, so a student can read the new
-- columns on rows they can already see and cannot change them.
-- =====================================================================

alter table public.lessons
  add column min_time_seconds integer not null default 90,
  add column pass_percentage integer not null default 60;

alter table public.lessons
  add constraint lessons_min_time_seconds_check
    check (min_time_seconds between 0 and 3600),
  add constraint lessons_pass_percentage_check
    check (pass_percentage between 1 and 100);

update public.lessons
   set min_time_seconds = 0
 where content_type = 'quiz';

alter table public.games
  add column orientation text not null default 'any';

alter table public.games
  add constraint games_orientation_check
    check (orientation in ('portrait', 'landscape', 'any'));
