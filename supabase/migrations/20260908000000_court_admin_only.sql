-- ============================================================================
-- Court Elections — restrict to admins only, drop the delegable permission.
--
-- manage_court (added in 20260907000000) let an admin delegate the roster/
-- voting-toggle tool to any role or member without handing over full SGA
-- election management. In practice this is the one tool that can stuff or
-- wipe the homecoming ballot outright (no voter identity, no dedup — see
-- 20260906000000), so it's being pulled back to admin-only rather than staying
-- a configurable permission. The frontend gate moved from RequirePermission
-- ("manage_court") to RequireAdmin (role.is_admin) — this migration makes the
-- RLS match, since frontend gating is UX only and RLS is the real boundary.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Repoint the homecoming RLS policies to is_admin()
-- ----------------------------------------------------------------------------
-- The public read policy on homecoming_candidates is unchanged: the signed-out
-- kiosk still reads the roster (column-level grant still excludes student_id).
drop policy if exists "Members with manage_court can manage homecoming candidates"
  on public.homecoming_candidates;
drop policy if exists "Admins can manage homecoming candidates"
  on public.homecoming_candidates;
create policy "Admins can manage homecoming candidates"
  on public.homecoming_candidates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Members with manage_court can manage homecoming ballots"
  on public.homecoming_ballots;
drop policy if exists "Admins can manage homecoming ballots"
  on public.homecoming_ballots;
create policy "Admins can manage homecoming ballots"
  on public.homecoming_ballots for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- cast_homecoming_ballot() is untouched: it is security definer and granted to
-- anon, so the kiosk's write path never depended on either key. site_settings
-- (the homecoming_voting_open toggle) was already admin-only via the existing
-- "Admins can update site settings" policy (20260607030000) — no change needed.

-- ----------------------------------------------------------------------------
-- 2. Clean up the now-unused manage_court key
-- ----------------------------------------------------------------------------
-- Nothing reads this key anymore (the permission checkbox was removed from
-- PERMISSION_KEYS in src/lib/permissions.js) — strip it so a role's/member's
-- stored permissions jsonb doesn't carry a dead, misleading grant.
update public.roles
set permissions = permissions - 'manage_court'
where permissions ? 'manage_court';

update public.profiles
set permission_overrides = permission_overrides - 'manage_court'
where permission_overrides ? 'manage_court';
