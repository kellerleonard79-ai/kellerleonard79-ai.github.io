-- ============================================================================
-- Auto-upgrade an election winner's role based on the position they won.
--
-- Until now, confirm_election_winner only changed a winner's role when the
-- admin manually picked one from a dropdown at confirm time. If they forgot,
-- an Applicant who won an election kept the Applicant role and stayed locked
-- out of the dashboard. This migration makes the upgrade automatic:
--
--   * elected_positions gains a `default_role_id` — the role that winning the
--     position grants. It is admin-editable (Admin > Elected Positions), in
--     keeping with the "roles/positions are data, not enums" rule.
--   * confirm_election_winner falls back to that role when the caller doesn't
--     pass an explicit override, and only ever *upgrades* (never downgrades a
--     member who already holds a higher-order role).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. default_role_id: which role winning this position grants.
-- ----------------------------------------------------------------------------
alter table public.elected_positions
  add column if not exists default_role_id uuid
    references public.roles (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. Seed sensible defaults for the built-in positions: exec board -> the
--    Executive Officer tier, class positions -> the Class Officer tier. Only
--    fills positions that don't already have a grant role configured, so it's
--    safe to re-run and won't clobber admin choices.
-- ----------------------------------------------------------------------------
update public.elected_positions p
set default_role_id = r.id
from public.roles r
where p.default_role_id is null
  and p."group" = 'exec'
  and r.name = 'Executive Officer';

update public.elected_positions p
set default_role_id = r.id
from public.roles r
where p.default_role_id is null
  and p."group" in ('senior', 'junior', 'sophomore', 'freshman')
  and r.name = 'Class Officer';

-- ----------------------------------------------------------------------------
-- 3. confirm_election_winner — same behaviour as before, but when no explicit
--    p_upgrade_role_id is passed it auto-applies the position's default_role_id
--    (upgrade-only). An explicit override always wins.
-- ----------------------------------------------------------------------------
create or replace function public.confirm_election_winner(
  p_candidate_id   uuid,
  p_upgrade_role_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id       uuid;
  v_member_id      uuid;
  v_position_id    uuid;
  v_target_role_id uuid;
  v_target_order   integer;
  v_current_order  integer;
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

  -- Resolve which role to apply. An explicit override always wins; otherwise
  -- fall back to the role the won position is configured to grant.
  v_target_role_id := p_upgrade_role_id;
  if v_target_role_id is null then
    select default_role_id into v_target_role_id
    from public.elected_positions
    where id = v_position_id;

    -- Auto-grant is upgrade-only: never demote a member who already holds a
    -- higher-order role (e.g. an exec winning a lesser position later).
    if v_target_role_id is not null then
      select r."order" into v_target_order
      from public.roles r where r.id = v_target_role_id;
      select r."order" into v_current_order
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = v_member_id;
      if v_current_order is not null and coalesce(v_target_order, 0) <= v_current_order then
        v_target_role_id := null;
      end if;
    end if;
  end if;

  -- Allow the profile role/clearance change below to pass the guard triggers.
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

grant execute on function public.confirm_election_winner(uuid, uuid) to authenticated;
