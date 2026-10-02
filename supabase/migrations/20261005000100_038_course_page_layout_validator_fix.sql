-- =====================================================================
-- 038: Fix to 037's course_page_layout_is_valid. A MISSING `visible`, `key` or
-- custom `id` made jsonb_typeof() return SQL NULL, and `NULL <> 'boolean'` is NULL,
-- so the guard did not fire and such an entry was accepted (found by the role-
-- switched verification right after 037 was applied). The comparisons now use
-- IS DISTINCT FROM. Same function, same signature; the CHECK picks it up as is.
-- No stored row was affected (the only rows written in between were test rows).
-- =====================================================================

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
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'key') is distinct from 'string' then return false; end if;
    if jsonb_typeof(e -> 'visible') is distinct from 'boolean' then return false; end if;
    k := e ->> 'key';

    if k = any (array['about', 'learn', 'inside', 'how', 'need', 'reviews', 'made_by', 'faq']) then
      if k = any (seen_builtin) then return false; end if;
      seen_builtin := seen_builtin || k;
      if (e - array['key', 'visible', 'title', 'intro']) <> '{}'::jsonb then return false; end if;
      if e ? 'title' and not public.course_json_text_is_valid(e -> 'title', 0, 80) then return false; end if;
      if e ? 'intro' and not public.course_json_text_is_valid(e -> 'intro', 0, 200) then return false; end if;

    elsif k = 'custom' then
      if jsonb_typeof(e -> 'id') is distinct from 'string' or coalesce(e ->> 'id', '') !~ '^[a-z0-9-]{8,36}$' then return false; end if;
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
