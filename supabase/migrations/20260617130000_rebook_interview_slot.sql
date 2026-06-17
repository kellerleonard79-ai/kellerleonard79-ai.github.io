-- ============================================================================
-- Let an applicant change their already-booked interview slot.
--
-- The original module exposed book + cancel as separate RPCs. To switch times
-- the client would have to cancel-then-book, which has two problems:
--   1. If someone grabs the target between the two calls, the applicant loses
--      their old slot and gets nothing.
--   2. The partial unique index (session_id, booked_by_id) forbids holding two
--      slots in the same session, so "book new before releasing old" can't even
--      be attempted within a session.
-- A single transaction sidesteps both: release the applicant's current
-- booking(s) and claim the target slot atomically, with the target locked the
-- whole time so a concurrent booker serializes behind us.
-- ============================================================================
create or replace function public.rebook_interview_slot(p_slot_id uuid)
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

  select id into v_applicant
  from public.applicants
  where member_id = v_uid
  order by created_at desc
  limit 1;

  if v_applicant is null then
    raise exception 'No application found for your account.';
  end if;

  -- Lock the target first so the availability check and the claim are atomic
  -- against another applicant racing for the same slot.
  select * into v_slot from public.interview_slots where id = p_slot_id for update;
  if not found then
    raise exception 'Slot not found.';
  end if;
  if not v_slot.is_available then
    raise exception 'That slot is not available.';
  end if;
  -- Re-selecting the slot you already hold is a no-op success.
  if v_slot.booked_by_id is not null and v_slot.booked_by_id is distinct from v_applicant then
    raise exception 'That slot was just booked by someone else.';
  end if;

  -- Release whatever this applicant currently holds (any session), then claim
  -- the target. Freeing first keeps us clear of the one-per-session index.
  update public.interview_slots
    set booked_by_id = null
    where booked_by_id = v_applicant and id <> p_slot_id;

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

grant execute on function public.rebook_interview_slot(uuid) to authenticated;
