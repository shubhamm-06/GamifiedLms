-- =====================================================================
-- 034: Parent-facing course page v2 — admin-authored page content, look, and
-- a student-safe lesson outline.
--
-- Additive only: every new column is nullable or defaulted, so existing
-- courses keep working untouched. Plain text everywhere — no HTML, ever.
-- Array / jsonb limits live in IMMUTABLE functions used by CHECK constraints
-- (the avatar_config_is_valid approach, migration 032), not triggers.
--
-- No RLS change: `courses_select_published_or_admin` already lets any student
-- read every column of a published, non-trashed course, so the new page
-- columns are readable under the same rule as title/description. Writable
-- only through the existing `courses_admin_update` (fn_is_admin()).
--
-- `fn_course_outline` is the one new read path: a non-enrolled student cannot
-- read modules/lessons directly (their RLS requires enrollment or is_preview),
-- so this SECURITY DEFINER function returns ONLY titles, types, positions,
-- minutes and the preview flag for PUBLISHED lessons — never content blocks,
-- URLs, bundles, quiz questions or answers.
-- =====================================================================

-- ---- validation functions -------------------------------------------

create or replace function public.course_text_list_is_valid(items text[], max_items int, max_len int)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    items is not null
    and coalesce(array_ndims(items), 1) = 1
    and coalesce(cardinality(items), 0) <= max_items
    and not exists (
      select 1 from unnest(items) as i
      where i is null or btrim(i) = '' or char_length(i) > max_len
    ),
    false
  )
$fn$;

create or replace function public.course_faqs_are_valid(faqs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    case
      when faqs is null or jsonb_typeof(faqs) <> 'array' then false
      when jsonb_array_length(faqs) > 8 then false
      else not exists (
        select 1 from jsonb_array_elements(faqs) as e
        where jsonb_typeof(e) <> 'object'
           or (e - array['question', 'answer']) <> '{}'::jsonb
           or not (e ?& array['question', 'answer'])
           or jsonb_typeof(e -> 'question') <> 'string'
           or jsonb_typeof(e -> 'answer') <> 'string'
           or char_length(btrim(e ->> 'question')) not between 1 and 140
           or char_length(e ->> 'question') > 140
           or char_length(btrim(e ->> 'answer')) not between 1 and 600
           or char_length(e ->> 'answer') > 600
      )
    end,
    false
  )
$fn$;

create or replace function public.course_hidden_sections_are_valid(keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    keys is not null
    and coalesce(array_ndims(keys), 1) = 1
    and coalesce(cardinality(keys), 0) <= 8
    and not exists (
      select 1 from unnest(keys) as k
      where k is null
         or k <> all (array['about', 'learn', 'inside', 'how', 'know', 'need', 'made_by', 'faq'])
    ),
    false
  )
$fn$;

-- ---- columns ----------------------------------------------------------

alter table public.courses
  add column tagline text,
  add column age_min smallint,
  add column age_max smallint,
  add column language text,
  add column learning_outcomes text[] not null default '{}',
  add column requirements text[] not null default '{}',
  add column faqs jsonb not null default '[]'::jsonb,
  add column instructor_name text,
  add column instructor_role text,
  add column instructor_bio text,
  add column instructor_photo_url text,
  add column page_theme text not null default 'teal',
  add column page_font text not null default 'inter',
  add column page_hidden_sections text[] not null default '{}';

alter table public.courses
  add constraint courses_tagline_len_check check (tagline is null or char_length(tagline) <= 160),
  add constraint courses_age_min_range_check check (age_min is null or age_min between 1 and 18),
  add constraint courses_age_max_range_check check (age_max is null or age_max between 1 and 18),
  add constraint courses_age_order_check check (age_min is null or age_max is null or age_min <= age_max),
  add constraint courses_language_len_check check (language is null or char_length(language) <= 40),
  add constraint courses_learning_outcomes_check check (public.course_text_list_is_valid(learning_outcomes, 8, 120)),
  add constraint courses_requirements_check check (public.course_text_list_is_valid(requirements, 6, 120)),
  add constraint courses_faqs_check check (public.course_faqs_are_valid(faqs)),
  add constraint courses_instructor_name_len_check check (instructor_name is null or char_length(instructor_name) <= 80),
  add constraint courses_instructor_role_len_check check (instructor_role is null or char_length(instructor_role) <= 80),
  add constraint courses_instructor_bio_len_check check (instructor_bio is null or char_length(instructor_bio) <= 300),
  add constraint courses_instructor_photo_url_check check (
    instructor_photo_url is null
    or (instructor_photo_url ~ '^https://[^[:space:]]+$' and char_length(instructor_photo_url) <= 2048)
  ),
  add constraint courses_page_theme_check check (page_theme in ('teal', 'plum', 'coral', 'ink')),
  add constraint courses_page_font_check check (page_font in ('inter', 'classic', 'friendly')),
  add constraint courses_page_hidden_sections_check check (public.course_hidden_sections_are_valid(page_hidden_sections));

comment on column public.courses.tagline is 'Lead paragraph on the parent-facing course page. Plain text, <= 160. NULL/blank = no lead.';
comment on column public.courses.faqs is 'Parent-facing FAQ: array of {question, answer} (1-140 / 1-600 chars, no other keys), max 8. Validated by course_faqs_are_valid.';
comment on column public.courses.page_hidden_sections is 'Optional page sections an admin switched off: about, learn, inside, how, know, need, made_by, faq.';

-- ---- student-safe outline ----------------------------------------------

create or replace function public.fn_course_outline(p_course_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with visible as (
    select c.id
      from public.courses c
     where c.id = p_course_id
       and c.deleted_at is null
       and (c.status = 'published' or public.fn_is_admin())
  ),
  lessons_pub as (
    select l.id, l.module_id, l.title, l.content_type, l.position, l.is_preview,
           case when l.min_time_seconds > 0 then ceil(l.min_time_seconds / 60.0)::int end as minutes
      from public.lessons l
      join visible v on v.id = l.course_id
      left join public.modules m on m.id = l.module_id
     where l.status = 'published'
       and l.deleted_at is null
       and (l.module_id is null or m.deleted_at is null)
  ),
  grouped as (
    select lp.module_id,
           coalesce(m.title, '') as title,
           coalesce(m.position, 2147483647) as position,
           jsonb_agg(
             jsonb_build_object(
               'id', lp.id,
               'title', lp.title,
               'type', lp.content_type,
               'position', lp.position,
               'minutes', lp.minutes,
               'is_preview', lp.is_preview
             ) order by lp.position, lp.id
           ) as lessons
      from lessons_pub lp
      left join public.modules m on m.id = lp.module_id
     group by lp.module_id, m.title, m.position
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', g.module_id, 'title', g.title, 'position', g.position, 'lessons', g.lessons)
      order by g.position, g.module_id
    ),
    '[]'::jsonb
  )
  from grouped g
$fn$;

revoke all on function public.fn_course_outline(uuid) from public, anon;
grant execute on function public.fn_course_outline(uuid) to authenticated;

comment on function public.fn_course_outline(uuid) is
  'Parent-facing course page outline: [{id,title,position,lessons:[{id,title,type,position,minutes,is_preview}]}] for PUBLISHED lessons of a course the caller may see (published+live, or admin). Lessons without a module come back as one module with a null id and blank title. Never returns content, URLs, bundles or quiz data. authenticated only. Migration 034.';
