-- ============================================================================
-- Homecoming Court — anonymous kiosk voting.
--
-- Separate from the Elections module on purpose. `election_candidates` is tied
-- to election_cycles + elected_positions and is authenticated-only; Homecoming
-- Court is a throwaway, fully-anonymous ballot with its own short-lived roster,
-- so bolting it onto that schema would mean loosening RLS on real election data.
--
-- The ballot is cast from /kiosk, a public unlinked page a signed-out visitor
-- loads on a supervised laptop. Consequences that are intentional:
--
--   * NO voter identity and NO duplicate-vote prevention. The kiosk is watched
--     by a person; that supervision IS the control. Anyone holding the (public,
--     bundled) anon key can therefore stuff the box while voting is open, which
--     is why `site_settings.homecoming_voting_open` exists — closing it kills
--     the endpoint outright.
--   * One ballot row = one voter's full ballot (one female + one male from
--     their own grade), not one row per vote. Ballot counts and per-grade
--     turnout then fall straight out of the table.
--   * Anon cannot touch `homecoming_ballots` at all — not even to read the
--     running count. The only write path is cast_homecoming_ballot(), which
--     re-validates grade and gender server-side so a tampered client cannot
--     produce a ballot that breaks the tally.
--   * A cast ballot is a permanent record: removing a candidate NEVER deletes
--     ballots. The candidate reference goes null and the name snapshot taken at
--     cast time keeps the result readable. This matters because a ballot names
--     two people — cascading a deletion would have silently voided the OTHER
--     candidate's vote on every ballot that happened to include the removed
--     one.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

-- Gender is not typed by the admin — the UI has one column per gender and fills
-- it in, so the add form only ever asks for a name and a grade.
create table if not exists public.homecoming_candidates (
  id          uuid        primary key default gen_random_uuid(),
  full_name   text        not null,
  grade_level integer     not null check (grade_level between 9 and 12),
  gender      text        not null check (gender in ('female', 'male')),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists homecoming_candidates_ballot_idx
  on public.homecoming_candidates (grade_level, gender, sort_order);

-- Ballots outlive their candidates. The FK goes null on delete rather than
-- cascading, and the *_name snapshots (written by cast_homecoming_ballot at the
-- moment of the vote) mean a withdrawn candidate's tally stays legible instead
-- of turning into an unexplained gap between the totals and the ballot count.
create table if not exists public.homecoming_ballots (
  id                  uuid        primary key default gen_random_uuid(),
  grade_level         integer     not null check (grade_level between 9 and 12),
  female_candidate_id uuid        references public.homecoming_candidates (id) on delete set null,
  female_name         text        not null default '',
  male_candidate_id   uuid        references public.homecoming_candidates (id) on delete set null,
  male_name           text        not null default '',
  created_at          timestamptz not null default now()
);

-- Applied separately so re-running this file over an earlier copy of itself
-- (which had `not null` + `on delete cascade`) corrects the existing table
-- rather than silently leaving the old behavior in place.
alter table public.homecoming_ballots
  add column if not exists female_name text not null default '',
  add column if not exists male_name   text not null default '';

alter table public.homecoming_ballots
  alter column female_candidate_id drop not null,
  alter column male_candidate_id   drop not null;

alter table public.homecoming_ballots
  drop constraint if exists homecoming_ballots_female_candidate_id_fkey,
  drop constraint if exists homecoming_ballots_male_candidate_id_fkey;

alter table public.homecoming_ballots
  add constraint homecoming_ballots_female_candidate_id_fkey
    foreign key (female_candidate_id)
    references public.homecoming_candidates (id) on delete set null,
  add constraint homecoming_ballots_male_candidate_id_fkey
    foreign key (male_candidate_id)
    references public.homecoming_candidates (id) on delete set null;

create index if not exists homecoming_ballots_grade_idx
  on public.homecoming_ballots (grade_level);

-- The kiosk needs to know whether voting is open before a session exists, and
-- site_settings is already readable by anon — so the flag lives there rather
-- than in a new table needing its own public read policy.
alter table public.site_settings
  add column if not exists homecoming_voting_open boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
alter table public.homecoming_candidates enable row level security;
alter table public.homecoming_ballots    enable row level security;

-- The roster is public: the kiosk reads it while signed out.
drop policy if exists "Anyone can view homecoming candidates" on public.homecoming_candidates;
create policy "Anyone can view homecoming candidates"
  on public.homecoming_candidates for select
  to anon, authenticated
  using (true);

drop policy if exists "Members with manage_elections can manage homecoming candidates" on public.homecoming_candidates;
create policy "Members with manage_elections can manage homecoming candidates"
  on public.homecoming_candidates for all
  to authenticated
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

-- Deliberately no anon policy of any kind. Anonymous visitors write only
-- through cast_homecoming_ballot() below and can never read the running tally.
drop policy if exists "Members with manage_elections can manage homecoming ballots" on public.homecoming_ballots;
create policy "Members with manage_elections can manage homecoming ballots"
  on public.homecoming_ballots for all
  to authenticated
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

-- ----------------------------------------------------------------------------
-- 3. The one write path
-- ----------------------------------------------------------------------------
-- Unlike every other anon-granted function in this schema, this one is volatile
-- because it writes. Everything the client sends is re-checked here: an open
-- window, and two candidates that really are the claimed gender and really do
-- belong to the claimed grade.
create or replace function public.cast_homecoming_ballot(
  p_grade  integer,
  p_female uuid,
  p_male   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open        boolean;
  v_female_name text;
  v_male_name   text;
begin
  select homecoming_voting_open into v_open
  from public.site_settings
  where id = 1;

  if not coalesce(v_open, false) then
    raise exception 'Homecoming voting is closed';
  end if;

  -- Selecting the name doubles as the existence/gender/grade check.
  select full_name into v_female_name
  from public.homecoming_candidates
  where id = p_female and gender = 'female' and grade_level = p_grade;

  if v_female_name is null then
    raise exception 'That is not a valid candidate for grade %', p_grade;
  end if;

  select full_name into v_male_name
  from public.homecoming_candidates
  where id = p_male and gender = 'male' and grade_level = p_grade;

  if v_male_name is null then
    raise exception 'That is not a valid candidate for grade %', p_grade;
  end if;

  insert into public.homecoming_ballots (
    grade_level, female_candidate_id, female_name, male_candidate_id, male_name
  )
  values (p_grade, p_female, v_female_name, p_male, v_male_name);
end;
$$;

grant execute on function public.cast_homecoming_ballot(integer, uuid, uuid) to anon, authenticated;
