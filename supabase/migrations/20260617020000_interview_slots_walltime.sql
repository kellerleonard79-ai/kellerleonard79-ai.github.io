-- ============================================================================
-- Fix interview slot times being shifted by time zone.
--
-- BUG: generate/regenerate built each slot as `(date + start_time)` assigned to
-- a `timestamptz`. That cast reads the wall-clock value in the SERVER's zone
-- (UTC on hosted Supabase), so a 12:01 PM block was stored as 12:01+00. The
-- frontend renders with `new Date(iso).toLocaleTimeString()`, which converts
-- that instant back into the viewer's local zone — pushing a noon block into the
-- AM. The window was never wrong; only its zone interpretation was.
--
-- FIX: interview slots are wall-clock times for a single school, not instants on
-- a global timeline. Store them as `timestamp WITHOUT time zone` so no zone
-- conversion ever happens — the browser parses the zoneless ISO string as local
-- and shows exactly what the admin typed.
--
-- Existing rows were generated under the UTC-cast bug, so their stored wall
-- clock (e.g. 12:01) is already the value the admin intended; reinterpreting it
-- `at time zone 'UTC'` recovers that wall clock unchanged regardless of the
-- current session TimeZone.
-- ============================================================================

-- get_session_slots returns these columns explicitly, so it must be dropped
-- before the underlying column type can change.
drop function if exists public.get_session_slots(uuid);

alter table public.interview_slots
  alter column start_time type timestamp using (start_time at time zone 'UTC'),
  alter column end_time   type timestamp using (end_time   at time zone 'UTC');

-- Regenerate slots from a session's wall-clock window. Identical to the original
-- except v_start/v_end are zoneless `timestamp`, so `date + time` stays exactly
-- as entered.
create or replace function public.generate_interview_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamp := (new.date + new.start_time);
  v_end   timestamp := (new.date + new.end_time);
  v_step  interval  := make_interval(mins => new.slot_duration);
begin
  insert into public.interview_slots (session_id, start_time, end_time)
  select new.id, gs, gs + v_step
  from generate_series(v_start, v_end - v_step, v_step) as gs;
  return new;
end;
$$;

create or replace function public.regenerate_interview_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamp := (new.date + new.start_time);
  v_end   timestamp := (new.date + new.end_time);
  v_step  interval  := make_interval(mins => new.slot_duration);
begin
  if new.date          is distinct from old.date
     or new.start_time is distinct from old.start_time
     or new.end_time   is distinct from old.end_time
     or new.slot_duration is distinct from old.slot_duration then
    delete from public.interview_slots where session_id = new.id;
    insert into public.interview_slots (session_id, start_time, end_time)
    select new.id, gs, gs + v_step
    from generate_series(v_start, v_end - v_step, v_step) as gs;
  end if;
  return new;
end;
$$;

-- Recreate the privacy-preserving read API with zoneless timestamp columns.
create or replace function public.get_session_slots(p_session_id uuid)
returns table (
  id           uuid,
  start_time   timestamp,
  end_time     timestamp,
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
