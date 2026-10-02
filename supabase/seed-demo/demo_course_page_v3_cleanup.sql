-- =====================================================================
-- Undo demo_course_page_v3.sql: resets the three migration-037 page columns
-- (page_layout, page_options, testimonials) to their defaults on the "Demo:"
-- courses only. Every other column, and every non-demo course, is left alone.
-- (The repo had no earlier demo-seed cleanup script to extend; this is the first.)
-- =====================================================================

update public.courses set
  page_layout = '[]'::jsonb,
  page_options = '{}'::jsonb,
  testimonials = '[]'::jsonb
where title like 'Demo:%' and slug like 'demo-%';
