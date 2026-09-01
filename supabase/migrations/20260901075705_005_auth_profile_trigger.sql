-- =====================================================================
-- Gamified LMS — Migration 005: auto-create profiles on signup
-- profiles.display_name and profiles.email are NOT NULL with no
-- population path, so supabase.auth.signUp() would otherwise succeed in
-- auth.users and leave the app broken with no matching profiles row.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_handle_new_user — populates public.profiles for every new
-- auth.users row. SECURITY DEFINER because the inserting role (the
-- Auth service, via the trigger) has no client-facing INSERT policy on
-- profiles — this is the one path that's allowed to create a row.
-- ---------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone_number, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'phone_number',
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger trg_auth_user_created
after insert on auth.users
for each row execute function public.fn_handle_new_user();
