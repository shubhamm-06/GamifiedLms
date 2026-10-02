-- =====================================================================
-- 036: Course slugs become part of public URLs (/course/<slug>), so they must be
-- URL-safe and unambiguous.
--
-- A slug is lowercase letters and digits in hyphen-separated groups, at most 80
-- characters, and may NOT look like a UUID (the app accepts either a slug or a
-- course id in a course URL, and tells them apart by shape; a UUID-shaped slug
-- would shadow a real id). Every existing row already complies (checked before
-- applying), so the constraint is added validated.
-- Uniqueness is unchanged: `uq_courses_slug_live` (live rows only, migration 013).
-- =====================================================================

alter table public.courses
  add constraint courses_slug_format_check check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) <= 80
    and slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

comment on constraint courses_slug_format_check on public.courses is
  'URL-safe slug (a-z, 0-9, single hyphens between groups), <= 80 chars, never UUID-shaped. Migration 036.';
