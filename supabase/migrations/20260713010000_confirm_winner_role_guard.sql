-- ============================================================================
-- Finding A (Phase 1), Step 3 — harden confirm_election_winner and reconcile
-- the drifted role/clearance guard triggers.
--
-- Two problems this closes:
--
--   1. confirm_election_winner accepted a caller-supplied p_upgrade_role_id,
--      letting a manage_elections holder grant a winner *any* non-admin role.
--      manage_elections must never confer the power to hand out roles. The
--      override is removed outright (the frontend already stopped sending it);
--      the granted role is now derived solely from the won position's
--      default_role_id and bounded by two guards enforced INSIDE the function:
--        * order guard  — a caller may not grant a role that outranks their own
--          tier (strict `>`, so a delegated Exec Officer can still confirm an
--          equal-order position for someone else; with the upgrade-only check
--          this makes self-escalation impossible — see the comment on the guard).
--        * powers guard — granting a role that itself holds is_admin OR
--          manage_roles requires the caller to hold manage_roles, closing the
--          two-step "grant a manage_roles role, then have them promote you" chain.
--
--   2. prevent_role_change had drifted: 20260617070000 rewrote it and dropped
--      the `app.allow_role_change` flag clause, so it reverts EVERY role_id
--      change by a non-manage_roles caller — including confirm_election_winner's
--      legitimate grant. (prevent_clearance_change kept the flag clause, which is
--      how the pre-Step-2 escalation rode in on clearance_level alone.) This
--      restores the flag clause to prevent_role_change, so the now-guarded
--      confirm_election_winner can actually upgrade a winner's role again, while
--      keeping the permission_overrides guard added in 20260617070000.
--      prevent_clearance_change already honors the flag and is left unchanged.
--
-- Ordering note: the client half (Elections.jsx calling the RPC with one arg)
-- must already be deployed before this runs — this drops the 2-arg signature.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Replace confirm_election_winner with the single-argument, guarded version.
--    The 2-arg overload is a distinct function object and must be dropped
--    explicitly — `create or replace` on the 1-arg signature would leave the
--    old 2-arg (override) form callable.
-- ----------------------------------------------------------------------------
drop function if exists public.confirm_election_winner(uuid, uuid);

create or replace function public.confirm_election_winner(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id            uuid;
  v_member_id           uuid;
  v_position_id         uuid;
  v_target_role_id      uuid;
  v_target_order        integer;
  v_target_is_admin     boolean;
  v_target_manage_roles boolean;
  v_current_order       integer;
  v_caller_order        integer;
begin
  if not public.has_permission('manage_elections') then
    raise exception 'permission denied: manage_elections required';
  end if;

  select cycle_id, member_id, position_id
    into v_cycle_id, v_member_id, v_position_id
  from public.election_candidates
  where id = p_candidate_id;

  if v_member_id is null then
    raise exception 'candidate not found';
  end if;

  -- Reject every other candidate for this position in the same cycle
  -- (`is not distinct from` so a null cycle compares equal to null).
  update public.election_candidates
  set status = 'rejected'
  where position_id = v_position_id
    and cycle_id is not distinct from v_cycle_id
    and id <> p_candidate_id;

  update public.election_candidates
  set status = 'winner'
  where id = p_candidate_id;

  -- Role to grant is derived solely from the won position. There is
  -- intentionally NO caller-supplied override (Finding A): the elections
  -- permission must never let its holder choose which role a winner receives.
  select default_role_id into v_target_role_id
  from public.elected_positions
  where id = v_position_id;

  if v_target_role_id is not null then
    select r."order",
           coalesce(r.is_admin, false),
           coalesce((r.permissions ->> 'manage_roles')::boolean, false)
      into v_target_order, v_target_is_admin, v_target_manage_roles
    from public.roles r
    where r.id = v_target_role_id;

    select r."order" into v_current_order
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = v_member_id;

    -- auth.uid() is the calling officer even inside this SECURITY DEFINER
    -- function, so this is the caller's own tier, not the definer's.
    select r."order" into v_caller_order
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid();

    -- Upgrade-only: never demote a member who already holds a higher-order role
    -- (e.g. an exec who later wins a lesser position). Nulling the target here
    -- means "assign the position, leave the role alone".
    if v_current_order is not null
       and coalesce(v_target_order, 0) <= v_current_order then
      v_target_role_id := null;
    end if;

    -- Escalation guard 1 (order). A caller may not grant a role that outranks
    -- their own tier. Strict `>` (not `>=`): a self-grant only survives the
    -- upgrade-only check above when target_order > the member's current order,
    -- and for a self-grant caller == member, so "would raise my own tier" is
    -- exactly target_order > caller_order — which this rejects. Self-escalation
    -- is therefore impossible, while a delegated Exec Officer can still confirm
    -- an equal-order position for someone else.
    if v_target_role_id is not null
       and (v_caller_order is null or coalesce(v_target_order, 0) > v_caller_order) then
      raise exception 'permission denied: cannot grant a role above your own tier';
    end if;

    -- Escalation guard 2 (powers). Granting a role that itself holds is_admin OR
    -- manage_roles requires the caller to hold manage_roles. Without this, a
    -- manage_elections holder could grant a manage_roles-bearing role to an
    -- accomplice who then promotes them — a two-step path to admin.
    if v_target_role_id is not null
       and (v_target_is_admin or v_target_manage_roles)
       and not public.has_permission('manage_roles') then
      raise exception 'permission denied: granting an admin or role-managing tier requires manage_roles';
    end if;
  end if;

  -- Open the guard window ONLY after every check above has passed. Setting this
  -- flag is what lets the role_id/clearance write below through the guard
  -- triggers; it must never be set before the grant is validated. See the
  -- SECURITY-CRITICAL note in prevent_role_change().
  perform set_config('app.allow_role_change', 'on', true);

  if v_target_role_id is not null then
    update public.profiles
    set elected_position_id = v_position_id,
        role_id             = v_target_role_id,
        clearance_level     = public.clearance_for_role(v_target_role_id)
    where id = v_member_id;
  else
    update public.profiles
    set elected_position_id = v_position_id
    where id = v_member_id;
  end if;
end;
$$;

grant execute on function public.confirm_election_winner(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Reconcile prevent_role_change: restore the app.allow_role_change flag
--    clause (dropped in 20260617070000) while keeping that migration's
--    permission_overrides guard. This lets the guarded confirm_election_winner
--    perform its role grant; nothing else may.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- role_id may change only when the editor holds manage_roles, OR when the
  -- app.allow_role_change flag is set for this transaction.
  --
  -- SECURITY-CRITICAL: confirm_election_winner is the ONLY function permitted to
  -- set app.allow_role_change, and it must set it ONLY after it has validated
  -- the grant (order guard + powers guard, above). This flag is the entire
  -- reason a caller without manage_roles can move role_id at all. If any other
  -- code path sets it — or sets it before validating the grant — it reopens the
  -- Finding A privilege-escalation hole. Do not set this flag anywhere else.
  if new.role_id is distinct from old.role_id
     and not public.has_permission('manage_roles')
     and coalesce(current_setting('app.allow_role_change', true), 'off') <> 'on' then
    new.role_id := old.role_id;
  end if;

  -- permission_overrides has no legitimate flag-based writer, so it is guarded
  -- on manage_roles only (no flag exception) — tighter than role_id on purpose.
  if new.permission_overrides is distinct from old.permission_overrides
     and not public.has_permission('manage_roles') then
    new.permission_overrides := old.permission_overrides;
  end if;

  return new;
end;
$$;
