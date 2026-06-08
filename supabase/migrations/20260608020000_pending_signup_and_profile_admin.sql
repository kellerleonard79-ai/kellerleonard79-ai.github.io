-- ============================================================================
-- Approval queue + admin profile management
--
-- 1. New signups land with status = 'pending' and must be approved by an SCI
--    before they can use the app (the app blocks login for pending accounts).
--    The very first user (the bootstrap admin) is created 'active'.
-- 2. Admins can delete profile rows (needed for the "delete account" control).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Teach handle_new_user() to set status. Mirrors the latest definition from
--    20260607030000 (which also assigns role_id) and only adds `status`.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user  boolean;
  admin_role_id  uuid;
  member_role_id uuid;
begin
  lock table public.profiles in exclusive mode;

  select not exists (select 1 from public.profiles) into is_first_user;

  select id into admin_role_id  from public.roles where is_admin order by "order" desc limit 1;
  select id into member_role_id from public.roles where name = 'General Member' limit 1;

  insert into public.profiles (
    id, student_id, full_name, grade_level, shirt_size, email,
    clearance_level, role_id, status
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'grade_level', '')::integer,
    new.raw_user_meta_data ->> 'shirt_size',
    new.email,
    case when is_first_user then 'admin' else 'member' end,
    case when is_first_user then admin_role_id else member_role_id end,
    case when is_first_user then 'active' else 'pending' end
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Allow admins to delete any profile (for the SCI "delete account" control).
--    Deleting a profile cascades to that member's attendance rows; the
--    underlying auth.users record is not removed by this policy.
-- ----------------------------------------------------------------------------
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());
