-- ============================================================================
-- Member profiles: extra display fields for the profile page & directory
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New profile columns shown on the member profile / directory.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists position  text,                              -- "Executive Vice President"
  add column if not exists academy   text,                             -- "SCI" badge
  add column if not exists dues_paid boolean not null default false,   -- PAID / UNPAID
  add column if not exists status    text    not null default 'active',-- active | inactive
  add column if not exists email     text;

-- ----------------------------------------------------------------------------
-- 2. Backfill email from the auth user for existing rows.
-- ----------------------------------------------------------------------------
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ----------------------------------------------------------------------------
-- 3. Redefine the signup trigger so new profiles capture the email too.
--    (Mirrors handle_new_user from 20260606000000_create_profiles.sql.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  lock table public.profiles in exclusive mode;

  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (
    id, student_id, full_name, grade_level, shirt_size, email, clearance_level
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'grade_level', '')::integer,
    new.raw_user_meta_data ->> 'shirt_size',
    new.email,
    case when is_first_user then 'admin' else 'member' end
  );

  return new;
end;
$$;
