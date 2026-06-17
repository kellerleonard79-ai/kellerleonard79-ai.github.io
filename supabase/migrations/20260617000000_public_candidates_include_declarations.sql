-- ============================================================================
-- Public candidate feed: also surface inline candidacy declarations
--
-- Two parallel candidate systems still coexist (see 20260616050000's note):
--   * applicants / positions          — the new "My Application" checklist flow
--                                        (rules + endorsement → fully_qualified),
--                                        which also backs interview scheduling.
--   * election_candidates / elected_positions
--                                      — the older inline "My Candidacy" flow,
--                                        written by set_my_candidate_position().
--
-- get_public_candidates() previously read only `applicants`, so a member who
-- declared through the inline Candidacy page (creating an election_candidates
-- row but no applicants row) never appeared on the public Elections roster.
--
-- This UNIONs both sources so anyone running through either path shows up. A
-- member who has started a full application is represented by that richer row;
-- their inline declaration is suppressed to avoid a duplicate card. Inline-only
-- declarations are surfaced as 'provisional' since they haven't completed the
-- application checklist. Rejected declarations stay hidden.
-- ============================================================================

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
  select a.id, p.full_name, a.position_id, pos.title, a.status
  from public.applicants a
  join public.profiles p on p.id = a.member_id
  left join public.positions pos on pos.id = a.position_id

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
