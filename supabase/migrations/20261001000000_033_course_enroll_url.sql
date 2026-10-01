-- =====================================================================
-- 033: A student-visible course info page for students who are not enrolled,
-- with an admin-set external "Enroll now" link.
--
-- `courses.enroll_url` is the only new thing: a plain https link an admin
-- pastes (a payment page, a form, a WhatsApp link — whatever). The app never
-- opens anything else, never stores a secret here, and this migration does
-- not touch enrollment itself — `enrollments` rows are still created exactly
-- as they are today (admin manual-enroll, or whatever purchase flow exists
-- outside the app).
--
-- No RLS change: `courses_select_published_or_admin` (migration 003) already
-- reads `(status = 'published' AND deleted_at IS NULL) OR fn_is_admin()` with
-- no enrollment check at all — a student can already read every column of
-- any published, non-trashed course, enrolled or not (verified live with a
-- role-switched query; see state.md). `enroll_url` is just one more column
-- under the same policy. `courses_admin_update`/`courses_admin_insert`
-- (`fn_is_admin()`) already allow an admin to write it — no new write path.
-- =====================================================================

alter table public.courses
  add column enroll_url text;

alter table public.courses
  add constraint courses_enroll_url_format_check
  check (
    enroll_url is null
    or (
      enroll_url ~ '^https://[^[:space:]]+$'
      and char_length(enroll_url) <= 2048
    )
  );

comment on column public.courses.enroll_url is
  'Where the student-facing "Enroll now" button on the course info page (not-enrolled students, CoursePage.tsx) sends them — a payment page, a form, a WhatsApp link, etc. NULL hides the button ("Enrollment isn''t open yet"). https only, <= 2048 chars (courses_enroll_url_format_check). Opening it never changes enrollment state; enrollment is still created the existing way (admin manual-enroll or an external flow). Migration 033.';
