-- ============================================================================
-- SGA Student Registration — profiles table, RLS, and role bootstrap
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles table
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid        primary key references auth.users (id) on delete cascade,
  student_id      text        unique,
  full_name       text,
  grade_level     integer,
  shirt_size      text,
  clearance_level text        not null default 'member',
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Admin check helper (SECURITY DEFINER so it bypasses RLS and avoids the
--    infinite-recursion trap of a policy that queries its own table).
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and clearance_level = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- A user can read their own profile.
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Admins can read every profile.
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- A user can update their own profile (clearance changes are blocked by the
-- prevent_clearance_change trigger below).
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- NB: there is intentionally no INSERT policy. Profile rows are created only by
-- the handle_new_user trigger (SECURITY DEFINER), so users cannot forge rows.

-- ----------------------------------------------------------------------------
-- 4. Auto-create a profile when a new auth user signs up.
--    The very first user to register becomes 'admin'; everyone after is
--    'member'. Student details are read from the signUp metadata
--    (supabase.auth.signUp({ options: { data: {...} } })).
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
  -- Lock the table so two simultaneous first-time signups can't both win admin.
  lock table public.profiles in exclusive mode;

  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (
    id, student_id, full_name, grade_level, shirt_size, clearance_level
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'grade_level', '')::integer,
    new.raw_user_meta_data ->> 'shirt_size',
    case when is_first_user then 'admin' else 'member' end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Stop non-admins from escalating their own clearance_level via UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_clearance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clearance_level is distinct from old.clearance_level
     and not public.is_admin() then
    new.clearance_level := old.clearance_level;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_clearance_change on public.profiles;
create trigger prevent_clearance_change
  before update on public.profiles
  for each row execute function public.prevent_clearance_change();
