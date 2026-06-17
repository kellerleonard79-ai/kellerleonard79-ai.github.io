-- ============================================================================
-- Make interview sessions fully editable.
--
-- The original module (20260616050000) only generates slots on INSERT, so an
-- admin editing a session's date / window / slot length would leave the old
-- slots in place. This adds an AFTER UPDATE trigger that regenerates the slot
-- grid whenever any timing field changes.
--
-- Regeneration deletes the existing slots first, so any bookings on that
-- session are cleared — intentional: if the times moved, the old bookings are
-- no longer valid and applicants must re-book. (Editing nothing timing-related,
-- e.g. a future label column, leaves slots and bookings untouched.)
-- ============================================================================
create or replace function public.regenerate_interview_slots()
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

drop trigger if exists interview_sessions_regenerate_slots on public.interview_sessions;
create trigger interview_sessions_regenerate_slots
  after update on public.interview_sessions
  for each row execute function public.regenerate_interview_slots();
