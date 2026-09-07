-- ============================================================================
-- my_candidacy(): add cycle_active.
--
-- The sidebar shows "My Application" only while an election cycle is running.
-- The existing cycle_open flag can't answer that question: it derives from
-- current_open_cycle_id(), which also requires filing_deadline > now(). Using
-- it would yank the nav entry out from under candidates the moment filing
-- closed — exactly when they still owe endorsements and an interview booking.
--
-- cycle_active tracks only the admin's is_open toggle, which is what "an
-- election cycle is active" means to a human. Everything else in the function
-- is unchanged, so filing enforcement and the change-limit math are untouched.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
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
    'cycle_active',      exists (select 1 from public.election_cycles where is_open),
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
