-- ============================================================================
-- Elected-position application + interview scheduling
--
-- The backend for the "Apply for an Elected Position" flow:
--   positions          — what a candidate can run for (rich: markdown blurb +
--                        a checklist of requirements).
--   applicants         — a single position application. Becomes 'fully_qualified'
--                        only once the rules are acknowledged AND a signed doc is
--                        uploaded; otherwise it stays 'provisional'.
--   interview_sessions — an admin-defined block of time (e.g. 7:30–8:20 AM) that
--                        is automatically sliced into bookable slots.
--   interview_slots    — the individual intervals applicants book into.
--
-- All writes go through SECURITY DEFINER RPCs / RLS keyed on
-- public.has_permission('manage_elections') so the static frontend has no
-- trusted server of its own — the database IS the API.
--
-- NOTE (integration): `positions` and `applicants` deliberately parallel the
-- existing `elected_positions` / `election_candidates` tables, which back the
-- older inline candidacy flow. They are kept separate here so this scheduling
-- module is self-contained; reconcile/merge them once the new flow replaces the
-- old one. `applicants.member_id` is the addition that lets a signed-in user be
-- resolved to their application for secure booking.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- positions
-- ----------------------------------------------------------------------------
create table if not exists public.positions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,                                  -- Markdown
  requirements text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- applicants
--   status is modeled as text + CHECK (house convention — no native enums) so
--   it can be extended without ALTER TYPE. It is *derived*, never set by the
--   client: an application is 'fully_qualified' once the rules are acknowledged
--   and a signed document is on file, else 'provisional'. The trigger below
--   keeps it honest.
-- ----------------------------------------------------------------------------
create table if not exists public.applicants (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid references public.profiles(id) on delete cascade,
  student_id          text not null,
  position_id         uuid references public.positions(id) on delete set null,
  fallback_to_general boolean not null default false,
  signature_doc_url   text,
  rules_acknowledged  boolean not null default false,
  status              text not null default 'provisional'
                        check (status in ('provisional', 'fully_qualified')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- One application per member per position.
  unique (member_id, position_id)
);

create index if not exists applicants_position_idx on public.applicants(position_id);

-- Derive status from the two qualifying conditions on every write, so a client
-- can never mark itself 'fully_qualified' by sending the column directly.
create or replace function public.applicants_set_status()
returns trigger
language plpgsql
as $$
begin
  new.status := case
    when new.rules_acknowledged and coalesce(new.signature_doc_url, '') <> ''
      then 'fully_qualified'
    else 'provisional'
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists applicants_status_trg on public.applicants;
create trigger applicants_status_trg
  before insert or update on public.applicants
  for each row execute function public.applicants_set_status();

-- ----------------------------------------------------------------------------
-- interview_sessions
--   date + start/end as wall-clock time; slot_duration in minutes.
-- ----------------------------------------------------------------------------
create table if not exists public.interview_sessions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  slot_duration integer not null check (slot_duration > 0),
  created_at    timestamptz not null default now(),
  check (end_time > start_time)
);

-- ----------------------------------------------------------------------------
-- interview_slots
--   start/end as full timestamps (session date + time). One applicant may hold
--   at most one slot per session (partial unique index).
-- ----------------------------------------------------------------------------
create table if not exists public.interview_slots (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.interview_sessions(id) on delete cascade,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  is_available boolean not null default true,
  booked_by_id uuid references public.applicants(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists interview_slots_session_idx on public.interview_slots(session_id);

-- An applicant can't hold two slots in the same session — DB-level backstop for
-- the booking RPC.
create unique index if not exists interview_slots_one_per_session
  on public.interview_slots(session_id, booked_by_id)
  where booked_by_id is not null;

-- ============================================================================
-- Slot generation — slice a session into slot_duration-minute intervals.
--
-- Runs automatically AFTER INSERT on interview_sessions. SECURITY DEFINER so the
-- controlled bulk insert isn't blocked by interview_slots RLS. generate_series
-- walks from the start up to (end - duration) so every slot ends on or before
-- the block's end; a remainder shorter than one slot is simply dropped.
--   e.g. 07:30–08:20 @ 10m  ->  07:30, 07:40, 07:50, 08:00, 08:10  (5 slots)
-- ============================================================================
create or replace function public.generate_interview_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (new.date + new.start_time);
  v_end   timestamptz := (new.date + new.end_time);
  v_step  interval    := make_interval(mins => new.slot_duration);
begin
  insert into public.interview_slots (session_id, start_time, end_time)
  select new.id, gs, gs + v_step
  from generate_series(v_start, v_end - v_step, v_step) as gs;
  return new;
end;
$$;

drop trigger if exists interview_sessions_generate_slots on public.interview_sessions;
create trigger interview_sessions_generate_slots
  after insert on public.interview_sessions
  for each row execute function public.generate_interview_slots();

-- ============================================================================
-- Admin: toggle slot availability (blackouts)
--   Refuses to black out a slot that is currently booked — the admin must
--   release the booking first, so nobody silently loses a confirmed interview.
-- ============================================================================
create or replace function public.set_slot_availability(
  p_slot_id      uuid,
  p_is_available boolean
)
returns public.interview_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.interview_slots;
begin
  if not public.has_permission('manage_elections') then
    raise exception 'Not authorized to manage interview slots.';
  end if;

  -- Lock the row so a concurrent booking can't slip in between check and update.
  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Slot not found.';
  end if;

  if p_is_available = false and v_slot.booked_by_id is not null then
    raise exception 'Cannot black out a booked slot — release the booking first.';
  end if;

  update public.interview_slots
    set is_available = p_is_available
    where id = p_slot_id
    returning * into v_slot;

  return v_slot;
end;
$$;

grant execute on function public.set_slot_availability(uuid, boolean) to authenticated;

-- ============================================================================
-- Applicant: book a slot (concurrency-safe)
--   SELECT ... FOR UPDATE locks the slot row for the duration of the
--   transaction, so two applicants racing for the same slot serialize: the
--   second sees booked_by_id already set and is rejected. The partial unique
--   index is the final backstop against one applicant grabbing two slots.
-- ============================================================================
create or replace function public.book_interview_slot(p_slot_id uuid)
returns public.interview_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_applicant uuid;
  v_slot      public.interview_slots;
begin
  if v_uid is null then
    raise exception 'You must be signed in to book an interview.';
  end if;

  -- Resolve the caller's application. Most recent wins if they applied to
  -- multiple positions.
  select id into v_applicant
  from public.applicants
  where member_id = v_uid
  order by created_at desc
  limit 1;

  if v_applicant is null then
    raise exception 'No application found for your account.';
  end if;

  -- Lock the target slot for the rest of the transaction.
  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Slot not found.';
  end if;
  if not v_slot.is_available then
    raise exception 'That slot is not available.';
  end if;
  if v_slot.booked_by_id is not null then
    raise exception 'That slot was just booked by someone else.';
  end if;

  -- Claim it. The partial unique index rejects this if the applicant already
  -- holds another slot in the same session.
  update public.interview_slots
    set booked_by_id = v_applicant
    where id = p_slot_id
    returning * into v_slot;

  return v_slot;
exception
  when unique_violation then
    raise exception 'You already have a slot booked for this session.';
end;
$$;

grant execute on function public.book_interview_slot(uuid) to authenticated;

-- ============================================================================
-- Applicant: cancel their own booking (frees the slot for others)
-- ============================================================================
create or replace function public.cancel_interview_booking(p_slot_id uuid)
returns public.interview_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_applicant uuid;
  v_slot      public.interview_slots;
begin
  select id into v_applicant
  from public.applicants where member_id = v_uid
  order by created_at desc limit 1;

  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Slot not found.';
  end if;

  -- Allow the owner of the booking, or an elections admin, to release it.
  if v_slot.booked_by_id is distinct from v_applicant
     and not public.has_permission('manage_elections') then
    raise exception 'You can only cancel your own booking.';
  end if;

  update public.interview_slots
    set booked_by_id = null
    where id = p_slot_id
    returning * into v_slot;

  return v_slot;
end;
$$;

grant execute on function public.cancel_interview_booking(uuid) to authenticated;

-- ============================================================================
-- Read API: available slots for a session (privacy-preserving)
--   Applicants must NOT see who booked which slot, so they never read
--   interview_slots directly (RLS below restricts that to admins). This
--   function exposes only availability + a boolean "is this taken".
-- ============================================================================
create or replace function public.get_session_slots(p_session_id uuid)
returns table (
  id           uuid,
  start_time   timestamptz,
  end_time     timestamptz,
  is_available boolean,
  is_booked    boolean,
  is_mine      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.start_time, s.end_time, s.is_available,
         s.booked_by_id is not null as is_booked,
         exists (
           select 1 from public.applicants a
           where a.id = s.booked_by_id and a.member_id = auth.uid()
         ) as is_mine
  from public.interview_slots s
  where s.session_id = p_session_id
  order by s.start_time;
$$;

grant execute on function public.get_session_slots(uuid) to authenticated;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.positions          enable row level security;
alter table public.applicants         enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_slots    enable row level security;

-- positions: public read; managers write.
create policy "Anyone can view positions"
  on public.positions for select
  using (true);
create policy "Managers manage positions"
  on public.positions for all
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

-- applicants: a member sees/edits their own application; managers see all.
-- INSERT is constrained to your own member_id; status can't be forged because
-- the trigger always recomputes it.
create policy "Members read own application"
  on public.applicants for select
  using (member_id = auth.uid() or public.has_permission('manage_elections'));
create policy "Members create own application"
  on public.applicants for insert
  with check (member_id = auth.uid());
create policy "Members update own application"
  on public.applicants for update
  using (member_id = auth.uid() or public.has_permission('manage_elections'))
  with check (member_id = auth.uid() or public.has_permission('manage_elections'));
create policy "Managers delete applications"
  on public.applicants for delete
  using (public.has_permission('manage_elections'));

-- interview_sessions: authenticated can read (to render the schedule);
-- managers write. The slot-generation trigger runs SECURITY DEFINER.
create policy "Authenticated read sessions"
  on public.interview_sessions for select
  using (auth.uid() is not null);
create policy "Managers manage sessions"
  on public.interview_sessions for all
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));

-- interview_slots: only managers touch the base table directly. Applicants go
-- through get_session_slots() (read) and book/cancel RPCs (write), all
-- SECURITY DEFINER, so booked_by_id is never exposed to other applicants.
create policy "Managers manage slots"
  on public.interview_slots for all
  using (public.has_permission('manage_elections'))
  with check (public.has_permission('manage_elections'));
