-- ============================================================================
-- Candidate position selection
--
-- When candidacy is open, a Join SGA applicant who flags "I'm running for a
-- position" now also picks which position. That choice creates an
-- election_candidates row tied to the currently-open cycle. The applicant can
-- later change which position they're running for — up to a global limit, and
-- only until the cycle's filing deadline passes — even while their membership
-- is still pending approval, via a small self-service candidacy page.
--
--   election_cycles.filing_deadline               — after this, no new candidate
--                                                    applications and no position
--                                                    changes (set per cycle).
--   site_settings.candidate_position_change_limit — how many times a candidate
--                                                    may change their position
--                                                    (global, set in admin).
--   election_candidates.position_changes_used     — counter, enforced server-side.
--
-- Self-service runs through SECURITY DEFINER RPCs so a pending applicant (who
-- holds no elections permissions and cannot read election_cycles directly) can
-- still read and change only their own candidacy, with the limit and deadline
-- enforced in the database.
-- ============================================================================

alter table public.election_cycles
  add column if not exists filing_deadline timestamptz;

alter table public.site_settings
  add column if not exists candidate_position_change_limit integer not null default 3;

alter table public.election_candidates
  add column if not exists position_changes_used integer not null default 0;

-- ----------------------------------------------------------------------------
-- The currently-open cycle: open, and either no filing deadline or one still in
-- the future. SECURITY DEFINER so it can be consulted from anon contexts (the
-- Join trigger) and by applicants who can't read election_cycles directly.
-- ----------------------------------------------------------------------------
create or replace function public.current_open_cycle_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.election_cycles
  where is_open
    and (filing_deadline is null or filing_deadline > now())
  order by created_at desc
  limit 1;
$$;

grant execute on function public.current_open_cycle_id() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Candidate applications open? Now also respects the filing deadline so the
-- "I'm running" option disappears from the Join form once filing closes.
-- ----------------------------------------------------------------------------
create or replace function public.candidate_applications_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_open_cycle_id() is not null;
$$;

grant execute on function public.candidate_applications_open() to anon, authenticated;

-- ============================================================================
-- handle_new_user() — mirrors the latest definition (20260608100000) and adds
-- candidate-row creation: when a signup flags candidacy and includes a position,
-- record their candidacy against the currently-open cycle.
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
  v_is_candidate boolean;
  v_position_id  uuid;
  v_cycle_id     uuid;
begin
  lock table public.profiles in exclusive mode;

  select not exists (select 1 from public.profiles) into is_first_user;

  select id into admin_role_id  from public.roles where is_admin order by "order" desc limit 1;
  select id into member_role_id from public.roles where name = 'General Member' limit 1;

  v_is_candidate := coalesce((new.raw_user_meta_data ->> 'is_candidate_application')::boolean, false);

  insert into public.profiles (
    id, student_id, full_name, grade_level, shirt_size, email,
    clearance_level, role_id, status, is_candidate_application, custom_fields
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
    v_is_candidate,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'custom_fields', '')::jsonb,
      '{}'::jsonb
    )
  );

  -- If they applied as a candidate and picked a position, record their candidacy
  -- against the currently-open cycle. Silently skips if no cycle is open or the
  -- position is invalid — they can set it later on the candidacy page.
  if v_is_candidate then
    v_position_id := nullif(new.raw_user_meta_data ->> 'candidate_position_id', '')::uuid;
    v_cycle_id := public.current_open_cycle_id();
    if v_position_id is not null
       and v_cycle_id is not null
       and exists (
         select 1 from public.elected_positions
         where id = v_position_id and show_in_elections
       )
    then
      insert into public.election_candidates (cycle_id, member_id, position_id, status)
      values (v_cycle_id, new.id, v_position_id, 'pending')
      on conflict (cycle_id, member_id, position_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- my_candidacy() — the caller's candidacy in the open cycle, plus the limit and
-- deadline context the candidacy page needs. Returns null when not signed in.
-- ============================================================================
create or replace function public.my_candidacy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_cycle_id    uuid := public.current_open_cycle_id();
  v_limit       integer;
  v_cycle_name  text;
  v_deadline    timestamptz;
  v_cand_id     uuid;
  v_position_id uuid;
  v_pos_title   text;
  v_status      text;
  v_used        integer := 0;
begin
  if v_uid is null then
    return null;
  end if;

  select candidate_position_change_limit into v_limit
  from public.site_settings where id = 1;

  if v_cycle_id is not null then
    select name, filing_deadline into v_cycle_name, v_deadline
    from public.election_cycles where id = v_cycle_id;

    select ec.id, ec.position_id, ep.title, ec.status, ec.position_changes_used
      into v_cand_id, v_position_id, v_pos_title, v_status, v_used
    from public.election_candidates ec
    join public.elected_positions ep on ep.id = ec.position_id
    where ec.member_id = v_uid
      and ec.cycle_id is not distinct from v_cycle_id
    order by ec.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'cycle_open',        v_cycle_id is not null,
    'cycle_id',          v_cycle_id,
    'cycle_name',        v_cycle_name,
    'filing_deadline',   v_deadline,
    'change_limit',      coalesce(v_limit, 0),
    'candidate_id',      v_cand_id,
    'position_id',       v_position_id,
    'position_title',    v_pos_title,
    'status',            v_status,
    'changes_used',      coalesce(v_used, 0),
    'changes_remaining', greatest(coalesce(v_limit, 0) - coalesce(v_used, 0), 0)
  );
end;
$$;

grant execute on function public.my_candidacy() to authenticated;

-- ============================================================================
-- set_my_candidate_position() — declare or change the caller's position in the
-- open cycle. Enforces the change limit and filing deadline server-side. The
-- first selection in a cycle is free; each later change consumes one allowance.
-- ============================================================================
create or replace function public.set_my_candidate_position(p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_cycle_id uuid := public.current_open_cycle_id();
  v_limit    integer;
  v_row      record;
begin
  if v_uid is null then
    raise exception 'You must be signed in.';
  end if;
  if v_cycle_id is null then
    raise exception 'Candidate filing is not open right now.';
  end if;
  if not exists (
    select 1 from public.elected_positions
    where id = p_position_id and show_in_elections
  ) then
    raise exception 'That position is not available to run for.';
  end if;

  select candidate_position_change_limit into v_limit
  from public.site_settings where id = 1;

  select * into v_row
  from public.election_candidates
  where member_id = v_uid and cycle_id is not distinct from v_cycle_id
  order by created_at desc
  limit 1;

  if v_row.id is null then
    -- First selection for this cycle. Also flag the profile as a candidacy.
    insert into public.election_candidates (cycle_id, member_id, position_id, status)
    values (v_cycle_id, v_uid, p_position_id, 'pending');
    update public.profiles set is_candidate_application = true where id = v_uid;
  elsif v_row.position_id = p_position_id then
    null; -- no change
  else
    if coalesce(v_row.position_changes_used, 0) >= coalesce(v_limit, 0) then
      raise exception 'You have used all of your allowed position changes.';
    end if;
    update public.election_candidates
    set position_id           = p_position_id,
        position_changes_used = position_changes_used + 1,
        -- Re-open the new candidacy for review unless it was already finalized.
        status = case when status in ('winner', 'assigned') then status else 'pending' end
    where id = v_row.id;
  end if;

  return public.my_candidacy();
end;
$$;

grant execute on function public.set_my_candidate_position(uuid) to authenticated;
