-- =====================================================================
-- 037: Course page v3 — admin-ordered sections, page options, testimonials.
--
-- Additive only: three new NOT NULL jsonb columns on `courses`, each defaulted to
-- an empty value, so every existing course renders exactly as before (an empty
-- page_layout means "default order, legacy page_hidden_sections applied").
-- Shapes are enforced by IMMUTABLE validator functions used in CHECK
-- constraints (the migration 032/034 pattern), so a bad value cannot be written
-- by any path, not only the admin form. Unknown keys are rejected everywhere.
-- Plain text only: nothing here is ever rendered as HTML.
--
-- No RLS change: the columns are read under the existing
-- `courses_select_published_or_admin` and written only through
-- `courses_admin_update` (fn_is_admin()).
-- =====================================================================

-- ---- helpers -----------------------------------------------------------

create or replace function public.course_https_url_is_valid(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    jsonb_typeof(v) = 'string'
    and (v #>> '{}') ~ '^https://[^[:space:]]+$'
    and char_length(v #>> '{}') <= 2048,
    false
  )
$fn$;

-- A JSON string whose trimmed length is between lo and hi (lo = 0 allows blank).
create or replace function public.course_json_text_is_valid(v jsonb, lo int, hi int)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select coalesce(
    jsonb_typeof(v) = 'string'
    and char_length(btrim(v #>> '{}')) >= lo
    and char_length(v #>> '{}') <= hi,
    false
  )
$fn$;

-- A JSON array of 0..max_items non-blank strings, each <= max_len.
create or replace function public.course_json_text_list_is_valid(v jsonb, min_items int, max_items int, max_len int)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  e jsonb;
begin
  if v is null or jsonb_typeof(v) <> 'array' then return false; end if;
  if jsonb_array_length(v) < min_items or jsonb_array_length(v) > max_items then return false; end if;
  for e in select * from jsonb_array_elements(v) loop
    if not public.course_json_text_is_valid(e, 1, max_len) then return false; end if;
  end loop;
  return true;
end
$fn$;

-- ---- page_layout -------------------------------------------------------

create or replace function public.course_page_layout_is_valid(layout jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  e jsonb;
  k text;
  t text;
  seen_builtin text[] := '{}';
  seen_custom text[] := '{}';
  allowed text[];
begin
  if layout is null or jsonb_typeof(layout) <> 'array' or jsonb_array_length(layout) > 20 then
    return false;
  end if;

  for e in select * from jsonb_array_elements(layout) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'key') <> 'string' then return false; end if;
    if jsonb_typeof(e -> 'visible') <> 'boolean' then return false; end if;
    k := e ->> 'key';

    if k = any (array['about', 'learn', 'inside', 'how', 'need', 'reviews', 'made_by', 'faq']) then
      if k = any (seen_builtin) then return false; end if;
      seen_builtin := seen_builtin || k;
      if (e - array['key', 'visible', 'title', 'intro']) <> '{}'::jsonb then return false; end if;
      if e ? 'title' and not public.course_json_text_is_valid(e -> 'title', 0, 80) then return false; end if;
      if e ? 'intro' and not public.course_json_text_is_valid(e -> 'intro', 0, 200) then return false; end if;

    elsif k = 'custom' then
      if jsonb_typeof(e -> 'id') <> 'string' or (e ->> 'id') !~ '^[a-z0-9-]{8,36}$' then return false; end if;
      if (e ->> 'id') = any (seen_custom) then return false; end if;
      seen_custom := seen_custom || (e ->> 'id');
      if not public.course_json_text_is_valid(e -> 'title', 1, 80) then return false; end if;
      t := e ->> 'type';
      if t = 'text' then
        allowed := array['key', 'id', 'type', 'visible', 'title', 'body'];
        if e ? 'body' and not public.course_json_text_is_valid(e -> 'body', 0, 1200) then return false; end if;
      elsif t = 'list' then
        allowed := array['key', 'id', 'type', 'visible', 'title', 'items', 'list_style'];
        if not public.course_json_text_list_is_valid(e -> 'items', 1, 10, 140) then return false; end if;
        if coalesce(e ->> 'list_style', '') <> all (array['check', 'bullet', 'number']) then return false; end if;
      elsif t = 'image' then
        allowed := array['key', 'id', 'type', 'visible', 'title', 'image_url', 'alt', 'caption'];
        if not public.course_https_url_is_valid(e -> 'image_url') then return false; end if;
        if not public.course_json_text_is_valid(e -> 'alt', 1, 140) then return false; end if;
        if e ? 'caption' and not public.course_json_text_is_valid(e -> 'caption', 0, 140) then return false; end if;
      else
        return false;
      end if;
      if (e - allowed) <> '{}'::jsonb then return false; end if;

    else
      return false;
    end if;
  end loop;

  return coalesce(cardinality(seen_custom), 0) <= 6;
end
$fn$;

-- ---- page_options ------------------------------------------------------

create or replace function public.course_page_options_are_valid(opts jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  e jsonb;
  facts text[] := '{}';
begin
  if opts is null or jsonb_typeof(opts) <> 'object' then return false; end if;
  if (opts - array['cover', 'cta_label', 'price_note', 'included', 'hidden_facts', 'custom_facts', 'how_items', 'how_intro', 'outline']) <> '{}'::jsonb then
    return false;
  end if;

  if opts ? 'cover' then
    e := opts -> 'cover';
    if jsonb_typeof(e) <> 'object' or (e - array['show', 'focus']) <> '{}'::jsonb then return false; end if;
    if e ? 'show' and jsonb_typeof(e -> 'show') <> 'boolean' then return false; end if;
    if e ? 'focus' and coalesce(e ->> 'focus', '') <> all (array['top', 'center', 'bottom']) then return false; end if;
  end if;

  if opts ? 'cta_label' and not public.course_json_text_is_valid(opts -> 'cta_label', 0, 24) then return false; end if;
  if opts ? 'price_note' and not public.course_json_text_is_valid(opts -> 'price_note', 0, 80) then return false; end if;
  if opts ? 'how_intro' and not public.course_json_text_is_valid(opts -> 'how_intro', 0, 200) then return false; end if;
  if opts ? 'included' and not public.course_json_text_list_is_valid(opts -> 'included', 0, 6, 80) then return false; end if;
  if opts ? 'how_items' and not public.course_json_text_list_is_valid(opts -> 'how_items', 0, 8, 140) then return false; end if;

  if opts ? 'hidden_facts' then
    if jsonb_typeof(opts -> 'hidden_facts') <> 'array' then return false; end if;
    for e in select * from jsonb_array_elements(opts -> 'hidden_facts') loop
      if jsonb_typeof(e) <> 'string' or (e #>> '{}') <> all (array['ages', 'lessons', 'time', 'access', 'language']) then return false; end if;
      if (e #>> '{}') = any (facts) then return false; end if;
      facts := facts || (e #>> '{}');
    end loop;
  end if;

  if opts ? 'custom_facts' then
    if jsonb_typeof(opts -> 'custom_facts') <> 'array' or jsonb_array_length(opts -> 'custom_facts') > 3 then return false; end if;
    for e in select * from jsonb_array_elements(opts -> 'custom_facts') loop
      if jsonb_typeof(e) <> 'object' or (e - array['label', 'value']) <> '{}'::jsonb then return false; end if;
      if not public.course_json_text_is_valid(e -> 'label', 1, 24) then return false; end if;
      if not public.course_json_text_is_valid(e -> 'value', 1, 32) then return false; end if;
    end loop;
  end if;

  if opts ? 'outline' then
    e := opts -> 'outline';
    if jsonb_typeof(e) <> 'object' or (e - array['open', 'detail', 'show_minutes']) <> '{}'::jsonb then return false; end if;
    if e ? 'open' and coalesce(e ->> 'open', '') <> all (array['first', 'all', 'none']) then return false; end if;
    if e ? 'detail' and coalesce(e ->> 'detail', '') <> all (array['lessons', 'sections']) then return false; end if;
    if e ? 'show_minutes' and jsonb_typeof(e -> 'show_minutes') <> 'boolean' then return false; end if;
  end if;

  return true;
end
$fn$;

-- ---- testimonials ------------------------------------------------------

create or replace function public.course_testimonials_are_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  e jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 6 then return false; end if;
  for e in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(e) <> 'object' or (e - array['quote', 'name', 'relation', 'rating', 'photo_url']) <> '{}'::jsonb then return false; end if;
    if not public.course_json_text_is_valid(e -> 'quote', 10, 280) then return false; end if;
    if not public.course_json_text_is_valid(e -> 'name', 1, 60) then return false; end if;
    if e ? 'relation' and not public.course_json_text_is_valid(e -> 'relation', 0, 80) then return false; end if;
    if e ? 'rating' and not (
      jsonb_typeof(e -> 'rating') = 'number'
      and (e ->> 'rating') ~ '^[1-5]$'
    ) then return false; end if;
    if e ? 'photo_url' and not public.course_https_url_is_valid(e -> 'photo_url') then return false; end if;
  end loop;
  return true;
end
$fn$;

-- ---- columns -----------------------------------------------------------

alter table public.courses
  add column page_layout jsonb not null default '[]'::jsonb,
  add column page_options jsonb not null default '{}'::jsonb,
  add column testimonials jsonb not null default '[]'::jsonb;

alter table public.courses
  add constraint courses_page_layout_check check (public.course_page_layout_is_valid(page_layout)),
  add constraint courses_page_options_check check (public.course_page_options_are_valid(page_options)),
  add constraint courses_testimonials_check check (public.course_testimonials_are_valid(testimonials));

comment on column public.courses.page_layout is
  'Parent-facing page section order and per-section settings (built-in {key,visible,title?,intro?} and custom text/list/image blocks). Empty = default order with legacy page_hidden_sections applied. The v3 editor writes this and clears page_hidden_sections. Migration 037.';
comment on column public.courses.page_options is
  'Parent-facing page options: cover, cta_label, price_note, included, hidden_facts, custom_facts, how_items, how_intro, outline. Unknown keys rejected. Migration 037.';
comment on column public.courses.testimonials is
  'Parent testimonials, max 6 of {quote 10-280, name 1-60, relation?, rating? 1-5, photo_url? https}. Real feedback only, first name and initial, never a child''s name or photo (rules.md). Migration 037.';
