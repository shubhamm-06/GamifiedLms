-- =====================================================================
-- 022: The kid Home screen is the most recently used course's roadmap.
--
-- `enrollments.last_accessed_at` records when a student last opened a
-- course. Two SECURITY DEFINER functions (search_path = '', user from
-- auth.uid(), EXECUTE for `authenticated` only) are the only things that
-- read or write it on the student's behalf:
--
--   fn_touch_enrollment(p_course_id)  stamps now() on the caller's ACTIVE
--       enrollment in that course. Students have no UPDATE policy on
--       `enrollments` (only admins and service_role do), so this cannot be a
--       plain client update. A no-op for a course they are not actively
--       enrolled in, and for a trashed user (their old token stops working,
--       migration 014). It changes no `status`, so
--       `fn_update_course_student_count` does not move `total_students`.
--
--   fn_home_course()  the course id Home should show, or NULL for "nothing".
--       Candidates: the caller's active enrollments in a live, published
--       course. Most recent first by COALESCE(last_accessed_at, enrolled_at),
--       so a course never opened yet ranks by when access began (a course
--       enrolled today beats one last opened last month), then enrolled_at,
--       then id for a stable tie-break. Archived courses are excluded on
--       purpose: the courses policy only lets a student read `published`
--       rows, so showing one would land on the "isn't ready" screen.
--
-- The column is nullable with no default and is not backfilled: NULL means
-- "never opened", and the COALESCE above handles it.
-- =====================================================================

alter table public.enrollments
  add column last_accessed_at timestamptz;

comment on column public.enrollments.last_accessed_at is
  'When the student last opened this course (kid Home / roadmap). NULL = never opened. Written only by fn_touch_enrollment (migration 022).';

create or replace function public.fn_touch_enrollment(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.fn_user_is_trashed(auth.uid()) then
    return;
  end if;

  update public.enrollments
     set last_accessed_at = now()
   where user_id = auth.uid()
     and course_id = p_course_id
     and status = 'active';
end;
$$;

revoke all on function public.fn_touch_enrollment(uuid) from public, anon;
grant execute on function public.fn_touch_enrollment(uuid) to authenticated;

create or replace function public.fn_home_course()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.course_id
    from public.enrollments e
    join public.courses c on c.id = e.course_id
   where e.user_id = auth.uid()
     and not public.fn_user_is_trashed(auth.uid())
     and e.status = 'active'
     and c.deleted_at is null
     and c.status = 'published'
   order by coalesce(e.last_accessed_at, e.enrolled_at) desc, e.enrolled_at desc, e.id
   limit 1;
$$;

revoke all on function public.fn_home_course() from public, anon;
grant execute on function public.fn_home_course() to authenticated;
