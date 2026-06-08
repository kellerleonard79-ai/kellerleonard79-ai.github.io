-- ============================================================================
-- Elections — cycles, candidates, scoring, and winner assignment.
--
-- Two tables:
--   election_cycles      — a round of elections (e.g. "Spring 2026") with the
--                          interview/election weighting used to combine scores.
--   election_candidates  — a member running for one position, optionally tied to
--                          a cycle (cycle_id null = a mid-year fill).
--
-- Composite scores are computed and written by the app (weights live on the
-- cycle, not the candidate row), so composite_score is a plain nullable column
-- — NOT a generated column.
--
-- Winner confirmation and revocation run through SECURITY DEFINER RPCs so a
-- member who only holds `manage_elections` (and not `manage_roles`) can still
-- assign profiles.elected_position_id and optionally upgrade the winner's role.
-- The role/clearance guard triggers are taught to honour a transaction-local
-- flag the RPC sets, so this is the only path that bypasses them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.is_candidate_application — set at signup when a new member
--    indicated they are running for a position. Surfaces them in the Elections
--    "Join SGA applications" queue (vs. the plain Security Clearance queue).
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_candidate_application boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. election_cycles
-- ----------------------------------------------------------------------------
create table if not exists public.election_cycles (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  is_open          boolean     not null default false,
  open_date        timestamptz,
  close_date       timestamptz,
  interview_weight double precision not null default 0.5,
  election_weight  double precision not null default 0.5,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Weights must sum to 1.0. A small tolerance absorbs float rounding from the
  -- weight sliders (e.g. 0.35 + 0.65).
  constraint election_cycles_weights_sum
    check (abs(interview_weight + election_weight - 1.0) < 0.001)
);

-- ----------------------------------------------------------------------------
-- 3. election_candidates
-- ----------------------------------------------------------------------------
create table if not exists public.election_candidates (
  id              uuid        primary key default gen_random_uuid(),
  cycle_id        uuid        references public.election_cycles (id) on delete cascade, -- null = mid-year fill
  member_id       uuid        not null references public.profiles (id) on delete cascade,
  position_id     uuid        not null references public.elected_positions (id) on delete cascade,
  status          text        not null default 'pending'
    check (status in ('pending','interviewing','approved','rejected','winner','assigned')),
  interview_score double precision check (interview_score >= 0 and interview_score <= 100),
  interview_notes text        not null default '',
  vote_count      integer,
  vote_percentage double precision check (vote_percentage >= 0 and vote_percentage <= 100),
  composite_score double precision,  -- computed + written by the app, not generated
  created_at      timestamptz not null default now(),
  -- A member may only have one candidacy per position within a given cycle.
  constraint election_candidates_unique unique (cycle_id, member_id, position_id)
);

create index if not exists election_candidates_cycle_idx
  on public.election_candidates (cycle_id);
create index if not exists election_candidates_position_idx
  on public.election_candidates (position_id);

-- ============================================================================
-- 4. RLS — read by view_elections, write by manage_elections.
-- ============================================================================
alter table public.election_cycles     enable row level security;
alter table public.election_candidates enable row level security;

create policy "Members with view_elections can view cycles"
  on public.election_cycles for select
  to authenticated
  using (public.has_permission('view_elections'));

create policy "Members with manage_elections can manage cycles"
  on public.election_cycles for all
  to authenticated
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

create policy "Members with view_elections can view candidates"
  on public.election_candidates for select
  to authenticated
  using (public.has_permission('view_elections'));

create policy "Members with manage_elections can manage candidates"
  on public.election_candidates for all
  to authenticated
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

-- ============================================================================
-- 5. Teach handle_new_user() to record is_candidate_application from signup
--    metadata. Mirrors the latest definition (20260608020000) and only adds the
--    new column.
-- ============================================================================
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
    clearance_level, role_id, status, is_candidate_application
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
    case when is_first_user then 'active' else 'pending' end,
    coalesce((new.raw_user_meta_data ->> 'is_candidate_application')::boolean, false)
  );

  return new;
end;
$$;

-- ============================================================================
-- 6. Let the winner-assignment RPC bypass the role/clearance guards via a
--    transaction-local flag. Outside that flag the existing manage_roles rule
--    is unchanged.
-- ============================================================================
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_id is distinct from old.role_id
     and not public.has_permission('manage_roles')
     and coalesce(current_setting('app.allow_role_change', true), 'off') <> 'on' then
    new.role_id := old.role_id;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_clearance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clearance_level is distinct from old.clearance_level
     and not public.has_permission('manage_roles')
     and coalesce(current_setting('app.allow_role_change', true), 'off') <> 'on' then
    new.clearance_level := old.clearance_level;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6a. Legacy clearance string for a role, mirroring the frontend helper.
-- ----------------------------------------------------------------------------
create or replace function public.clearance_for_role(p_role_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when r.is_admin then 'admin'
    when coalesce((r.permissions ->> 'create_meetings')::boolean, false) then 'officer'
    else 'member'
  end
  from public.roles r
  where r.id = p_role_id;
$$;

-- ============================================================================
-- 7. confirm_election_winner — mark a candidate the winner, reject the other
--    candidates for that position in the same cycle, assign the position to the
--    member, and optionally upgrade their role. manage_elections only.
-- ============================================================================
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
  v_cycle_id    uuid;
  v_member_id   uuid;
  v_position_id uuid;
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

  -- Allow the profile role/clearance change below to pass the guard triggers.
  perform set_config('app.allow_role_change', 'on', true);

  if p_upgrade_role_id is not null then
    update public.profiles
    set elected_position_id = v_position_id,
        role_id             = p_upgrade_role_id,
        clearance_level     = public.clearance_for_role(p_upgrade_role_id)
    where id = v_member_id;
  else
    update public.profiles
    set elected_position_id = v_position_id
    where id = v_member_id;
  end if;
end;
$$;

-- ============================================================================
-- 8. revoke_election_winner — clear the member's assigned position and keep the
--    candidate record (status -> 'assigned'). manage_elections only.
-- ============================================================================
create or replace function public.revoke_election_winner(p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id   uuid;
  v_position_id uuid;
begin
  if not public.has_permission('manage_elections') then
    raise exception 'permission denied: manage_elections required';
  end if;

  select member_id, position_id
    into v_member_id, v_position_id
  from public.election_candidates
  where id = p_candidate_id;

  if v_member_id is null then
    raise exception 'candidate not found';
  end if;

  update public.profiles
  set elected_position_id = null
  where id = v_member_id
    and elected_position_id = v_position_id;

  update public.election_candidates
  set status = 'assigned'
  where id = p_candidate_id;
end;
$$;

grant execute on function public.confirm_election_winner(uuid, uuid) to authenticated;
grant execute on function public.revoke_election_winner(uuid)        to authenticated;
