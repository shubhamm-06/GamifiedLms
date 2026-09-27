-- =====================================================================
-- 028: lessons.pass_percentage becomes quiz-only, not a blanket default.
--
-- The task that asked for this named it lessons.quiz_pass_threshold, a new
-- nullable 0-100 column "only meaningful when content_type = 'quiz'; leave
-- null for every other lesson type" -- which is exactly lessons.pass_percentage
-- (migration 015), already read by real grading (fn_submit_quiz, 017) and
-- already editable in LessonDialog as "Pass mark". Rather than add a second,
-- functionally-identical column, this migration reshapes the existing one to
-- match the requested semantics instead of duplicating it:
--   - was: integer not null default 60, check 1-100, stored (and ignored) for
--     every lesson regardless of type
--   - now: integer nullable, check 0-100, NULL for every non-quiz lesson,
--     and a quiz lesson must have a value (a bidirectional CHECK, not just
--     convention -- the same "mirror the shape, don't just discover it via a
--     failed insert" standard lesson_content_blocks already set).
-- The 70% app-level default now lives only in the client (DEFAULT_PASS_PERCENTAGE,
-- lib/lessonSettings.ts) for a new/never-set quiz lesson's form -- not a
-- column default, so it can never leak onto a non-quiz row again.
--
-- fn_submit_quiz is NOT touched: grading is explicitly out of scope for the
-- task this migration belongs to, and every quiz lesson keeps a concrete,
-- non-null value under the new CHECK, so its existing
-- `score*100 >= pass_percentage*questions` arithmetic never sees a NULL.
-- app_settings.quiz_pass_threshold_percent (migration 010, still read by
-- nothing) is untouched too -- wiring it in as a site-wide fallback is a
-- separate, later change to fn_submit_quiz, not this one.
--
-- BACKFILL: every existing non-quiz lesson's pass_percentage (all seeded at
-- the old blanket default, 60, and never meaningful) is set to NULL. Every
-- existing quiz lesson keeps its real, already-graded-against value.
-- =====================================================================

alter table public.lessons
  alter column pass_percentage drop not null,
  alter column pass_percentage drop default;

alter table public.lessons
  drop constraint lessons_pass_percentage_check;

update public.lessons
   set pass_percentage = null
 where content_type <> 'quiz';

alter table public.lessons
  add constraint lessons_pass_percentage_check
  check (pass_percentage is null or pass_percentage between 0 and 100);

alter table public.lessons
  add constraint lessons_pass_percentage_quiz_only_check
  check ((content_type = 'quiz') = (pass_percentage is not null));

comment on column public.lessons.pass_percentage is
  'Whole-percent pass mark for a quiz lesson (0-100), read by fn_submit_quiz. NULL for every non-quiz lesson; a quiz lesson must have a value -- both directions enforced by lessons_pass_percentage_quiz_only_check. Migration 028 (was NOT NULL DEFAULT 60 for every lesson type since migration 015; the 70% default for a new/unset quiz lesson now lives only in the client, lib/lessonSettings.ts).';
