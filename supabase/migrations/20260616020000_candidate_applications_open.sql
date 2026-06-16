-- ============================================================================
-- Public check: are candidate applications currently open?
--
-- The Join SGA form lets a new signup flag "I'm running for a position". That
-- option should only appear while an election cycle is actually open. The Join
-- page is anonymous, but election_cycles is gated to authenticated members with
-- `view_elections`, so anon can't read it directly. This SECURITY DEFINER
-- function exposes just the boolean — true when at least one cycle is open —
-- without leaking any cycle data.
-- ============================================================================
create or replace function public.candidate_applications_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.election_cycles where is_open
  );
$$;

grant execute on function public.candidate_applications_open() to anon, authenticated;
