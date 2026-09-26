-- =====================================================================
-- 023: Block-based content for doc (text) lessons.
--
-- `lesson_content_blocks` holds a lesson's content as ordered typed blocks
-- instead of one HTML string (`lessons.content_html` stays and is the kid
-- app's fallback for a lesson with no blocks). Three block types, no open
-- type field:
--   paragraph  text_content
--   callout    text_content + callout_color (gold|teal|coral|plum, the locked
--              tokens) + callout_icon (info|idea|star|heart|question)
--   image      image_url (paste-only, like games.bundle_url; no upload flow)
--              + optional image_alt
-- A CHECK ties the columns to the type, so a row can never carry another
-- type's fields. `position` orders blocks within a lesson, the same pattern as
-- lessons.position (not unique, so a reorder can write positions in any order).
--
-- RLS. Students SELECT blocks of a PUBLISHED lesson they may read: the lesson is
-- live (`fn_lesson_is_live`: lesson, course and module not trashed) and is a
-- preview lesson or the caller has an active enrollment in its course and is not
-- trashed. That is the `lessons_select_enrolled_or_preview_or_admin` shape plus
-- `status = 'published'` (the lessons policy itself has no status check, a
-- known finding in state.md; blocks do not inherit it). Admins read everything
-- and are the only writers. No student write path.
--
-- Deleting a lesson deletes its blocks (ON DELETE CASCADE). Trashing a lesson
-- hides them through `fn_lesson_is_live`.
-- =====================================================================

create table public.lesson_content_blocks (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  position      int  not null default 0,
  block_type    text not null,
  text_content  text,
  callout_color text,
  callout_icon  text,
  image_url     text,
  image_alt     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint lesson_content_blocks_type_check
    check (block_type in ('paragraph', 'callout', 'image')),
  constraint lesson_content_blocks_color_check
    check (callout_color is null or callout_color in ('gold', 'teal', 'coral', 'plum')),
  constraint lesson_content_blocks_icon_check
    check (callout_icon is null or callout_icon in ('info', 'idea', 'star', 'heart', 'question')),
  constraint lesson_content_blocks_image_url_check
    check (image_url is null or image_url ~* '^https?://'),
  -- Each type carries exactly its own columns.
  constraint lesson_content_blocks_shape_check
    check (
      (block_type = 'paragraph'
        and btrim(coalesce(text_content, '')) <> ''
        and callout_color is null and callout_icon is null
        and image_url is null and image_alt is null)
      or
      (block_type = 'callout'
        and btrim(coalesce(text_content, '')) <> ''
        and callout_color is not null and callout_icon is not null
        and image_url is null and image_alt is null)
      or
      (block_type = 'image'
        and image_url is not null
        and text_content is null
        and callout_color is null and callout_icon is null)
    )
);

comment on table public.lesson_content_blocks is
  'Ordered typed content blocks (paragraph, callout, image) for a doc lesson; lessons.content_html is the fallback when a lesson has none. Migration 023.';

create index idx_lesson_content_blocks_lesson_position
  on public.lesson_content_blocks (lesson_id, position);

create trigger trg_lesson_content_blocks_updated_at
  before update on public.lesson_content_blocks
  for each row execute function public.fn_set_updated_at();

alter table public.lesson_content_blocks enable row level security;

create policy lesson_content_blocks_select_enrolled_or_preview_or_admin
  on public.lesson_content_blocks
  for select using (
    public.fn_is_admin()
    or (
      public.fn_lesson_is_live(lesson_content_blocks.lesson_id)
      and exists (
        select 1
          from public.lessons l
         where l.id = lesson_content_blocks.lesson_id
           and l.status = 'published'
           and (
             l.is_preview
             or (
               not public.fn_user_is_trashed(auth.uid())
               and exists (
                 select 1 from public.enrollments e
                  where e.course_id = l.course_id
                    and e.user_id = auth.uid()
                    and e.status = 'active'
               )
             )
           )
      )
    )
  );

create policy lesson_content_blocks_admin_insert on public.lesson_content_blocks
  for insert with check (public.fn_is_admin());

create policy lesson_content_blocks_admin_update on public.lesson_content_blocks
  for update using (public.fn_is_admin()) with check (public.fn_is_admin());

create policy lesson_content_blocks_admin_delete on public.lesson_content_blocks
  for delete using (public.fn_is_admin());

-- =====================================================================
-- Demo content for the three existing doc lessons of "Demo: Fun with
-- Numbers", so the renderer has something real to show. Each insert selects
-- from `lessons`, so an environment without these lesson ids gets nothing, and
-- `not exists` keeps a re-run from duplicating blocks. The image URL is a
-- placeholder picture to be replaced with real artwork.
-- =====================================================================

insert into public.lesson_content_blocks (lesson_id, position, block_type, text_content, callout_color, callout_icon, image_url, image_alt)
select l.id, b.position, b.block_type, b.text_content, b.callout_color, b.callout_icon, b.image_url, b.image_alt
  from public.lessons l
  join (values
    -- Fun Facts About Numbers
    ('8a9d4384-2410-4efa-b7ce-30c5a20d5508'::uuid, 1, 'paragraph', 'Numbers are everywhere! They tell us how many, how big and how far away things are. Let''s find out some fun facts about them.', null, null, null, null),
    ('8a9d4384-2410-4efa-b7ce-30c5a20d5508'::uuid, 2, 'callout', 'Zero is a number too! It is how we say there is nothing there, like zero cookies left on the plate.', 'gold', 'star', null, null),
    ('8a9d4384-2410-4efa-b7ce-30c5a20d5508'::uuid, 3, 'callout', 'Infinity never ends! You can count as high as you like, and there is always one more number after it.', 'plum', 'idea', null, null),
    ('8a9d4384-2410-4efa-b7ce-30c5a20d5508'::uuid, 4, 'paragraph', 'Try counting to ten on your fingers, then on your toes. Which number are you at when you run out?', null, null, null, null),
    -- Shapes in Your Home
    ('b7657c51-4e04-4e92-a511-9758145b9e72'::uuid, 1, 'paragraph', 'Look around the room you are in. Shapes are hiding in almost everything you can see!', null, null, null, null),
    ('b7657c51-4e04-4e92-a511-9758145b9e72'::uuid, 2, 'image', null, null, null, 'https://placehold.co/800x450/png?text=Shapes+at+home', 'A picture of shapes found around a home'),
    ('b7657c51-4e04-4e92-a511-9758145b9e72'::uuid, 3, 'callout', 'A circle is round with no corners, like a plate or a clock.', 'teal', 'info', null, null),
    ('b7657c51-4e04-4e92-a511-9758145b9e72'::uuid, 4, 'callout', 'A rectangle has four sides and four corners, like a door or a book.', 'coral', 'star', null, null),
    ('b7657c51-4e04-4e92-a511-9758145b9e72'::uuid, 5, 'paragraph', 'How many circles and rectangles can you spot before you finish reading?', null, null, null, null),
    -- The Mystery of the Missing Cookies
    ('7e0758f9-760f-4560-85be-6331fd2df4a5'::uuid, 1, 'paragraph', 'Mia baked a plate of 8 cookies for her family. When she came back from feeding the cat, 3 of them had vanished!', null, null, null, null),
    ('7e0758f9-760f-4560-85be-6331fd2df4a5'::uuid, 2, 'callout', 'Puzzle time: 8 cookies, and 3 went missing. How many cookies are left on the plate?', 'coral', 'question', null, null),
    ('7e0758f9-760f-4560-85be-6331fd2df4a5'::uuid, 3, 'callout', 'Hint: count the 8 cookies on your fingers, then put 3 fingers down.', 'teal', 'idea', null, null),
    ('7e0758f9-760f-4560-85be-6331fd2df4a5'::uuid, 4, 'paragraph', 'There are 5 cookies left. And the crumbs on the cat''s whiskers? Now you know who the thief was!', null, null, null, null)
  ) as b(lesson_id, position, block_type, text_content, callout_color, callout_icon, image_url, image_alt)
    on b.lesson_id = l.id
 where not exists (
   select 1 from public.lesson_content_blocks x where x.lesson_id = l.id
 );
