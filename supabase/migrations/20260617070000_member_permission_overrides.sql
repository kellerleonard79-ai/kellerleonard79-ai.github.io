-- ============================================================================
-- Per-member permission overrides
--
-- Until now permissions came solely from a member's role (roles.permissions
-- jsonb). This adds an optional per-account override map on `profiles` so an
-- admin can grant or revoke individual permission keys for a single member on
-- top of their role — without inventing a whole new tier.
--
-- Semantics (mirrored in AuthContext.hasPermission and src/lib/permissions.js):
--   1. Admin tier (roles.is_admin) always passes — overrides cannot lock it out.
--   2. Otherwise a key present in profiles.permission_overrides wins (true =
--      grant, false = revoke).
--   3. Otherwise fall back to the role's permissions jsonb.
-- ============================================================================

alter table public.profiles
  add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- has_permission(key): now consults the caller's per-member overrides before
-- the role default. Admins still pass implicitly. A missing key (jsonb ->> is
-- null) coalesces through to the role permission, then to false.
-- ----------------------------------------------------------------------------
create or replace function public.has_permission(perm_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and (
        coalesce(r.is_admin, false)
        or coalesce(
             (p.permission_overrides ->> perm_key)::boolean,
             (r.permissions ->> perm_key)::boolean,
             false
           )
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- Guard: permission_overrides may only be changed by a member holding
-- manage_roles — same gate as role_id. A member who reaches `profiles` through
-- the edit_directory policy (dues toggle) has any override edit silently
-- reverted, mirroring the existing prevent_role_change behavior. (Admins pass
-- has_permission implicitly, so they are never reverted.)
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
  if new.permission_overrides is distinct from old.permission_overrides
     and not public.has_permission('manage_roles') then
    new.permission_overrides := old.permission_overrides;
  end if;
  return new;
end;
$$;
