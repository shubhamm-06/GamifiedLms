-- =====================================================================
-- 039: Testimonials v2 — drop star ratings; add an optional source platform and an
-- optional link to the real public post.
--
-- 1. DATA FIX FIRST (idempotent): every testimonial element loses its "rating" key, so no
--    live row can fail the new validator. Array order is preserved.
-- 2. The validator is replaced. Allowed keys per testimonial: quote (10-280), name (1-60),
--    relation? (<= 80), photo_url? (https), source? (google, facebook, instagram, whatsapp,
--    youtube, x, linkedin, website), post_url? (https, no whitespace, <= 2048, and ONLY
--    together with a source). Unknown keys (including rating) are rejected. Comparisons are
--    null-safe (IS DISTINCT FROM), the class of bug migration 038 fixed.
-- Max 6 entries is unchanged. No RLS change.
-- =====================================================================

update public.courses c
   set testimonials = coalesce(
         (select jsonb_agg(t.e - 'rating' order by t.ord)
            from jsonb_array_elements(c.testimonials) with ordinality as t(e, ord)),
         '[]'::jsonb)
 where exists (select 1 from jsonb_array_elements(c.testimonials) x where x ? 'rating');

create or replace function public.course_testimonials_are_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare
  e jsonb;
begin
  if items is null or jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 6 then
    return false;
  end if;
  for e in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(e) is distinct from 'object'
       or (e - array['quote', 'name', 'relation', 'photo_url', 'source', 'post_url']) <> '{}'::jsonb then
      return false;
    end if;
    if not public.course_json_text_is_valid(e -> 'quote', 10, 280) then return false; end if;
    if not public.course_json_text_is_valid(e -> 'name', 1, 60) then return false; end if;
    if e ? 'relation' and not public.course_json_text_is_valid(e -> 'relation', 0, 80) then return false; end if;
    if e ? 'photo_url' and not public.course_https_url_is_valid(e -> 'photo_url') then return false; end if;
    if e ? 'source' and (
         jsonb_typeof(e -> 'source') is distinct from 'string'
         or (e ->> 'source') <> all (array['google', 'facebook', 'instagram', 'whatsapp', 'youtube', 'x', 'linkedin', 'website'])
       ) then
      return false;
    end if;
    if e ? 'post_url' then
      if not (e ? 'source') then return false; end if;
      if not public.course_https_url_is_valid(e -> 'post_url') then return false; end if;
    end if;
  end loop;
  return true;
end
$fn$;

comment on column public.courses.testimonials is
  'Parent testimonials, max 6 of {quote 10-280, name 1-60, relation? <= 80, photo_url? https, source? (google|facebook|instagram|whatsapp|youtube|x|linkedin|website), post_url? https, only with a source}. No ratings. Real feedback only, first name and initial, never a child''s name or photo (rules.md). Migrations 037, 039.';
