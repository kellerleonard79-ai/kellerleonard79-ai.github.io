-- ============================================================================
-- Reconcile the two parallel election "position" systems (bridge approach)
--
-- Two candidate stacks grew up side by side (see 20260616050000's NOTE and
-- 20260617030000's header):
--   * System A — election_cycles -> election_candidates -> elected_positions:
--       admin scoring/winners, Join-SGA approval queue, profiles.elected_position_id,
--       role grants (confirm_election_winner), the public About page.
--   * System B — positions -> applicants -> interview_sessions/slots:
--       the "My Application" checklist, interview booking, public Elections roster.
--
-- The overlap was user-visible: two "choose a position" pickers backed by two
-- tables, and two candidate records per person that never linked (so a scored
-- candidate need not appear on the public roster, and interview bookings on the
-- applicants side never met the score on the election_candidates side).
--
-- This migration BRIDGES them (it does not collapse the two candidate tables):
--   1. elected_positions becomes the single position list — it absorbs the rich
--      `description` + `requirements` columns, `applicants.position_id` is
--      repointed at it, and the now-redundant `positions` table is dropped.
--   2. `applicants` gains `election_candidate_id` + a sync trigger, so completing
--      an application keeps a matching election_candidates row (one per member per
--      open cycle) in step with the candidacy — surfacing the applicant in the
--      admin scoring grid and keeping the public roster consistent.
--
-- Order matters: every reference to `positions` is repointed BEFORE the table is
-- dropped. Idempotent where practical (migrations are applied to the live DB by
-- hand, per CLAUDE.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. elected_positions absorbs the application table's rich columns.
-- ----------------------------------------------------------------------------
alter table public.elected_positions
  add column if not exists description  text,
  add column if not exists requirements text[] not null default '{}';

-- Any application `positions` title that has no matching elected_position yet
-- (e.g. one a manager added directly to the new-flow table) is promoted to a
-- real elected_position, so repointing applicants below can never orphan a row.
insert into public.elected_positions (title, "group", "order", show_in_elections)
select p.title, 'custom', 0, false
from public.positions p
where not exists (
  select 1 from public.elected_positions ep where ep.title = p.title
);

-- Carry the markdown blurb + requirements checklist over by matching title. The
-- columns are brand new (all null/empty), so this is a straight copy.
update public.elected_positions ep
set description  = p.description,
    requirements = p.requirements
from public.positions p
where p.title = ep.title;

-- ----------------------------------------------------------------------------
-- 2. Repoint applicants.position_id from `positions` to `elected_positions`.
--    Drop the old FK FIRST so the remap can write elected_positions ids (which
--    aren't in `positions`), then remap through the shared title, then re-add the
--    FK pointing at elected_positions.
-- ----------------------------------------------------------------------------
alter table public.applicants
  drop constraint if exists applicants_position_id_fkey;

update public.applicants a
set position_id = ep.id
from public.positions p
join public.elected_positions ep on ep.title = p.title
where a.position_id = p.id
  and a.position_id is not null;

alter table public.applicants
  add constraint applicants_position_id_fkey
    foreign key (position_id) references public.elected_positions(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. Bridge the candidate records: link applicants -> election_candidates and
--    keep one election_candidates row per member per open cycle in sync.
-- ----------------------------------------------------------------------------
alter table public.applicants
  add column if not exists election_candidate_id uuid
    references public.election_candidates(id) on delete set null;

-- BEFORE trigger: on any application write that names a position, mirror the
-- choice onto the member's single election_candidates row in the currently-open
-- cycle (moving it if they switched positions, mirroring set_my_candidate_position),
-- and stamp the link back onto the applicant. SECURITY DEFINER so it can write
-- election_candidates regardless of the applicant's own permissions. No-ops when
-- there is no open cycle — the applicant is linked the next time they save once a
-- cycle opens.
create or replace function public.sync_applicant_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_cand_id  uuid;
begin
  if new.member_id is null or new.position_id is null then
    return new;
  end if;

  v_cycle_id := public.current_open_cycle_id();
  if v_cycle_id is null then
    return new;
  end if;

  -- The member's existing candidacy in this cycle, if any (one per member).
  select id into v_cand_id
  from public.election_candidates
  where member_id = new.member_id
    and cycle_id is not distinct from v_cycle_id
  order by created_at desc
  limit 1;

  if v_cand_id is null then
    insert into public.election_candidates (cycle_id, member_id, position_id, status)
    values (v_cycle_id, new.member_id, new.position_id, 'pending')
    on conflict (cycle_id, member_id, position_id) do nothing
    returning id into v_cand_id;

    -- on-conflict skipped the insert (a row already existed): fetch it.
    if v_cand_id is null then
      select id into v_cand_id
      from public.election_candidates
      where member_id = new.member_id
        and cycle_id is not distinct from v_cycle_id
        and position_id = new.position_id
      limit 1;
    end if;

    update public.profiles set is_candidate_application = true where id = new.member_id;
  else
    -- Move the existing candidacy to the newly-chosen position; re-open it for
    -- review unless it was already finalized (mirrors set_my_candidate_position).
    update public.election_candidates
    set position_id = new.position_id,
        status = case when status in ('winner', 'assigned') then status else 'pending' end
    where id = v_cand_id
      and position_id is distinct from new.position_id;
  end if;

  new.election_candidate_id := v_cand_id;
  return new;
end;
$$;

drop trigger if exists applicants_sync_candidate_trg on public.applicants;
create trigger applicants_sync_candidate_trg
  before insert or update on public.applicants
  for each row execute function public.sync_applicant_candidate();

-- Backfill existing applications through the same trigger (a no-op write fires
-- BEFORE UPDATE, which links each applicant and upserts its candidate row).
update public.applicants set position_id = position_id;

-- ----------------------------------------------------------------------------
-- 4. Public roster feed now reads positions from elected_positions. The dedup
--    (suppress the inline-declaration branch for anyone who has an applicants
--    row) is unchanged, so linked applicants still show exactly once.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_candidates()
returns table (
  id             uuid,
  full_name      text,
  position_id    uuid,
  position_title text,
  status         text
)
language sql
stable
security definer
set search_path = public
as $$
  -- New-flow applications (status is derived: provisional | fully_qualified).
  select a.id, p.full_name, a.position_id, ep.title, a.status
  from public.applicants a
  join public.profiles p on p.id = a.member_id
  left join public.elected_positions ep on ep.id = a.position_id

  union all

  -- Inline candidacy declarations for members who haven't started a full
  -- application yet, so newly-declared candidates still appear publicly. These
  -- are always 'provisional' (they haven't completed the checklist).
  select ec.id, p.full_name, ec.position_id, ep.title, 'provisional'
  from public.election_candidates ec
  join public.profiles p on p.id = ec.member_id
  left join public.elected_positions ep on ep.id = ec.position_id
  where ec.status <> 'rejected'
    and not exists (
      select 1 from public.applicants a where a.member_id = ec.member_id
    )

  -- Order by the output columns (position title, then name) across the union.
  order by 4 nulls last, 2;
$$;

grant execute on function public.get_public_candidates() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Drop the now-redundant application positions table. Nothing references it
--    anymore (applicants repointed, get_public_candidates recreated); CASCADE
--    clears its policies/indexes.
-- ----------------------------------------------------------------------------
drop table if exists public.positions cascade;
