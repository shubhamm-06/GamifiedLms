-- ---------------------------------------------------------------------
-- 006. Games: description + thumbnail_url
-- ---------------------------------------------------------------------
-- Additive only. Both nullable, both paste-only (same convention as
-- courses.thumbnail_url — no Storage bucket exists for either).

alter table public.games add column description text;
alter table public.games add column thumbnail_url text;
