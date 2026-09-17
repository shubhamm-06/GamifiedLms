-- ---------------------------------------------------------------------
-- 007. Manual order creation
-- ---------------------------------------------------------------------
-- An admin recording a payment that happened outside the gateway (bank
-- transfer, cash, a goodwill comp) needs to create both the payment and
-- the enrollment it backs, atomically. Previously there was no admin
-- insert path onto payments at all (see rules.md, superseded by this).
--
-- fn_create_manual_order is a PLAIN function, not SECURITY DEFINER: its
-- two inserts run under the CALLING admin's own RLS, which is exactly
-- what should gate this (payments_admin_insert / enrollments_admin_insert,
-- both fn_is_admin()-gated). SECURITY DEFINER would bypass that and gate
-- on nothing but "can call this function", which is the wrong check.
-- ---------------------------------------------------------------------

create policy payments_admin_insert on public.payments
  for insert to authenticated with check (public.fn_is_admin());

create or replace function public.fn_create_manual_order(
  p_user_id uuid,
  p_course_id uuid,
  p_provider text,
  p_amount int,
  p_currency text,
  p_note text default null
)
returns uuid
language plpgsql
as $$
declare
  v_email text;
  v_access_type text;
  v_access_duration_days int;
  v_expires_at timestamptz;
  v_provider_payment_id text;
  v_payment_id uuid;
begin
  select email into v_email from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User % not found', p_user_id;
  end if;

  select access_type, access_duration_days into v_access_type, v_access_duration_days
  from public.courses where id = p_course_id;
  if not found then
    raise exception 'Course % not found', p_course_id;
  end if;

  -- Never ask the admin to type a fake gateway payment id — that's a
  -- system concern, and 'manual-' makes a manually-entered row
  -- unmistakable at a glance in provider_payment_id (which is unique
  -- across every real gateway id too, by construction).
  v_provider_payment_id := 'manual-' || gen_random_uuid()::text;

  insert into public.payments (
    user_id, course_id, provider, provider_payment_id, email,
    amount, currency, status, raw_payload, received_at
  ) values (
    p_user_id, p_course_id, p_provider, v_provider_payment_id, v_email,
    p_amount, p_currency, 'paid',
    jsonb_build_object('manual_entry', true, 'entered_by', auth.uid(), 'note', p_note),
    now()
  )
  returning id into v_payment_id;

  -- Same expires_at formula as the manual-enroll client path
  -- (useEnrollUser in useUserDetail.ts): 'fixed' + a duration computes a
  -- window from *now*, anything else (including a null duration on a
  -- 'fixed' course) is lifetime access. The two can't share code across
  -- the client/server boundary, so this is a deliberate re-implementation,
  -- not an oversight — see rules.md for the "keep both in sync by hand"
  -- invariant this creates.
  if v_access_type = 'fixed' and v_access_duration_days is not null then
    v_expires_at := now() + make_interval(days => v_access_duration_days);
  else
    v_expires_at := null;
  end if;

  -- A friendly, specific error instead of a raw unique-constraint message
  -- reaching the UI. The block below is the only thing rolled back on
  -- catching the violation; re-raising outside any further handler still
  -- aborts the whole function call, so the payment insert above is rolled
  -- back too — verified live, not just assumed from the transaction model.
  begin
    insert into public.enrollments (
      user_id, course_id, status, source, payment_id, enrolled_at, expires_at
    ) values (
      p_user_id, p_course_id, 'active', 'purchase', v_payment_id, now(), v_expires_at
    );
  exception
    when unique_violation then
      raise exception 'This student already has an enrollment for this course.';
  end;

  return v_payment_id;
end;
$$;
