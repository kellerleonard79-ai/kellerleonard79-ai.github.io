-- Drop the legacy clearance_level fallback from is_admin() and is_staff().
--
-- Finding A (Phase 1): is_admin() returning true on `clearance_level = 'admin'`
-- is the amplifier that let a stray clearance write confer full admin. The
-- role/permission system is the source of truth; clearance_level is a legacy
-- mirror. Removing the fallback here means a stuck or forged clearance value can
-- never confer admin (or staff) again.
--
-- Verified against prod before writing this:
--   * every profile has a non-null role_id (0 nulls), so nothing relies on the
--     fallback to stand in for a missing role;
--   * 0 profiles are admin-only via clearance (clearance='admin' AND role not
--     is_admin) — nobody is demoted by dropping the is_admin() fallback;
--   * 0 profiles are staff-only via clearance (clearance in ('admin','officer')
--     AND role grants none of is_admin / create_meetings / edit_agendas) — nobody
--     is demoted by dropping the is_staff() fallback.
--
-- The clearance_level column, its guard trigger (prevent_clearance_change), and
-- the write paths that keep it in sync all STAY for now. Retiring them is
-- Finding D, a separate change — this migration only stops trusting the column
-- for authorization.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and coalesce(r.is_admin, false)   -- was: ... or p.clearance_level = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and (
        coalesce(r.is_admin, false)
        or coalesce((r.permissions ->> 'create_meetings')::boolean, false)
        or coalesce((r.permissions ->> 'edit_agendas')::boolean, false)
        -- removed: or p.clearance_level in ('admin', 'officer')
      )
  );
$$;
