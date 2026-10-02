-- =====================================================================
-- 040: Direct enrollment for FREE courses from the website.
--
-- `fn_enroll_free_course(p_course_id)` is the ONLY way a student enrolls themselves. The
-- enrollments INSERT policy is deliberately NOT loosened (`enrollments_admin_insert` stays
-- admin-only): a SECURITY DEFINER function can enforce rules a policy cannot (the course must be
-- free, published and open; a revoked or expired learner is refused), and it reads the user from
-- auth.uid(), never from a parameter, so nobody can enroll somebody else.
--
-- Existing definitions reused, not invented:
--   * "free" = courses.is_free (the column that already drives the "Free" price on the page);
--   * source 'free' already exists in enrollments_source_check;
--   * expires_at is computed ONCE here, at insert time, from the course's own access fields,
--     exactly like the admin manual-enroll flow (useEnrollUser): fixed + a duration -> now() +
--     duration days, otherwise NULL (lifetime). It is never read live later (schema invariant);
--   * no payments row is created (payment_id stays NULL);
--   * the student-count trigger (trg_enrollments_student_count) fires on the INSERT exactly as it
--     does for an admin enrollment, so total_students rolls up with no extra code.
--
-- Errors are plain tokens (the client maps them to calm messages): not_authenticated,
-- course_not_found, course_archived, course_unavailable, not_free, enrollment_closed,
-- enrollment_revoked, enrollment_expired.
-- =====================================================================

create or replace function public.fn_enroll_free_course(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_course public.courses%rowtype;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_uid is null or public.fn_user_is_trashed(v_uid) then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_course from public.courses where id = p_course_id and deleted_at is null;
  if not found then
    raise exception 'course_not_found' using errcode = 'P0001';
  end if;

  -- Idempotent: someone who is already actively enrolled just gets their enrollment back
  -- (before any other rule, so a repeat call never fails because the course changed since).
  select e.id into v_id
    from public.enrollments e
   where e.user_id = v_uid and e.course_id = p_course_id and e.status = 'active'
   limit 1;
  if found then
    return v_id;
  end if;

  if v_course.status = 'archived' then
    raise exception 'course_archived' using errcode = 'P0001';
  end if;
  if v_course.status is distinct from 'published' then
    raise exception 'course_unavailable' using errcode = 'P0001';
  end if;
  if v_course.is_free is distinct from true then
    raise exception 'not_free' using errcode = 'P0001';
  end if;
  if v_course.enrollment_status is distinct from 'open' then
    raise exception 'enrollment_closed' using errcode = 'P0001';
  end if;

  -- Access that an admin ended is the admin's to restore (locked decision): never self-service.
  if exists (select 1 from public.enrollments e where e.user_id = v_uid and e.course_id = p_course_id and e.status = 'revoked') then
    raise exception 'enrollment_revoked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.enrollments e where e.user_id = v_uid and e.course_id = p_course_id and e.status = 'expired') then
    raise exception 'enrollment_expired' using errcode = 'P0001';
  end if;

  -- Same rule as the admin manual-enroll flow, computed once, at insert time.
  if v_course.access_type = 'fixed' and v_course.access_duration_days is not null then
    v_expires := now() + (v_course.access_duration_days * 86400) * interval '1 second';
  end if;

  begin
    insert into public.enrollments (user_id, course_id, source, status, expires_at)
    values (v_uid, p_course_id, 'free', 'active', v_expires)
    returning id into v_id;
  exception when unique_violation then
    -- A second tab won the race: return the winner (the partial unique index allows one active row).
    select e.id into v_id
      from public.enrollments e
     where e.user_id = v_uid and e.course_id = p_course_id and e.status = 'active'
     limit 1;
  end;

  return v_id;
end
$fn$;

revoke all on function public.fn_enroll_free_course(uuid) from public, anon;
grant execute on function public.fn_enroll_free_course(uuid) to authenticated;

comment on function public.fn_enroll_free_course(uuid) is
  'Self-enrollment for FREE courses (migration 040). SECURITY DEFINER, user from auth.uid() only. Returns the active enrollment id (idempotent). Refuses: unauthenticated, missing, archived or non-published course, non-free course, enrollment not open, and a user with a revoked or expired enrollment (an admin restores those). expires_at computed at insert time like the admin manual enroll. authenticated only.';
