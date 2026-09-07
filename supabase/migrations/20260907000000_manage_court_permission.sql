-- ============================================================================
-- manage_court — a permission key of its own for Court Elections.
--
-- Homecoming Court was gated on manage_elections because it started life as a
-- section of the admin panel's Elections group. It is now its own dashboard
-- page, and running the court (a roster of names and an open/closed toggle) is
-- a much smaller thing to hand someone than the SGA election machinery —
-- cycles, interview scores, and winner confirmation. Splitting the key lets an
-- admin delegate one without the other.
--
-- Nobody loses access: every role and every explicit per-member override that
-- currently grants manage_elections is backfilled with manage_court. Admin-tier
-- roles need no backfill (is_admin short-circuits has_permission).
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill
-- ----------------------------------------------------------------------------
update public.roles
set permissions = coalesce(permissions, '{}'::jsonb) || '{"manage_court": true}'::jsonb
where coalesce(permissions, '{}'::jsonb) ->> 'manage_elections' = 'true'
  and coalesce(permissions, '{}'::jsonb) ->> 'manage_court' is null;

-- Per-member overrides: only mirror an explicit grant. A revoke of
-- manage_elections says nothing about the court, so leave those alone and let
-- the role default apply.
update public.profiles
set permission_overrides =
  coalesce(permission_overrides, '{}'::jsonb) || '{"manage_court": true}'::jsonb
where coalesce(permission_overrides, '{}'::jsonb) ->> 'manage_elections' = 'true'
  and coalesce(permission_overrides, '{}'::jsonb) ->> 'manage_court' is null;

-- ----------------------------------------------------------------------------
-- 2. Repoint the homecoming RLS policies
-- ----------------------------------------------------------------------------
-- The public read policy on homecoming_candidates is unchanged: the signed-out
-- kiosk still reads the roster. Only the write side moves to the new key.
drop policy if exists "Members with manage_elections can manage homecoming candidates"
  on public.homecoming_candidates;
drop policy if exists "Members with manage_court can manage homecoming candidates"
  on public.homecoming_candidates;
create policy "Members with manage_court can manage homecoming candidates"
  on public.homecoming_candidates for all
  to authenticated
  using (public.has_permission('manage_court'))
  with check (public.has_permission('manage_court'));

drop policy if exists "Members with manage_elections can manage homecoming ballots"
  on public.homecoming_ballots;
drop policy if exists "Members with manage_court can manage homecoming ballots"
  on public.homecoming_ballots;
create policy "Members with manage_court can manage homecoming ballots"
  on public.homecoming_ballots for all
  to authenticated
  using (public.has_permission('manage_court'))
  with check (public.has_permission('manage_court'));

-- cast_homecoming_ballot() is deliberately untouched: it is security definer
-- and granted to anon, so the kiosk's write path does not depend on either key.
