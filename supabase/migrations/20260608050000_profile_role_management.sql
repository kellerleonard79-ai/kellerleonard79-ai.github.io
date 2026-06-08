-- ============================================================================
-- Profile role management (Security Clearance page) + directory dues editing
--
-- Until now the only UPDATE policy on `profiles` was "own profile", so no member
-- could edit another member's row — the SCI officer controls and the upcoming
-- Security Clearance page had no DB path to change a member's role_id or status.
--
-- This migration adds two permission-scoped UPDATE policies (mirroring the
-- frontend hasPermission gates) and a column guard so that role_id changes are
-- always gated by `manage_roles` specifically — even for a member who can only
-- reach `profiles` via the `edit_directory` policy (used for the dues toggle).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permission-scoped UPDATE policies. Permissive policies OR together, so a
--    member may update a row if they own it (existing policy), or hold
--    manage_roles, or hold edit_directory. Column-level limits are enforced by
--    the guard triggers below, matching the existing prevent_clearance_change
--    pattern.
-- ----------------------------------------------------------------------------
create policy "Role managers can update profiles"
  on public.profiles for update
  to authenticated
  using (public.has_permission('manage_roles'))
  with check (public.has_permission('manage_roles'));

create policy "Directory editors can update profiles"
  on public.profiles for update
  to authenticated
  using (public.has_permission('edit_directory'))
  with check (public.has_permission('edit_directory'));

-- ----------------------------------------------------------------------------
-- 2. Guard: role_id may only be changed by a member holding manage_roles.
--    Anyone reaching this table through the edit_directory policy (to flip
--    dues_paid) has their role_id edits silently reverted.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is distinct from old.role_id
     and not public.has_permission('manage_roles') then
    new.role_id := old.role_id;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_change on public.profiles;
create trigger prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ----------------------------------------------------------------------------
-- 3. Keep the legacy clearance_level guard in sync with the new permission
--    model: a member who can manage roles is also allowed to change the mirrored
--    clearance_level (the Security page / officer controls write both together).
--    Admins still pass implicitly via has_permission.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_clearance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clearance_level is distinct from old.clearance_level
     and not public.has_permission('manage_roles') then
    new.clearance_level := old.clearance_level;
  end if;
  return new;
end;
$$;
