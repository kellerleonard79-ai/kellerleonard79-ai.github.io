-- ============================================================================
-- Scheduled QR check-in windows for meetings
-- ============================================================================
-- Previously a meeting's QR check-in was open only while an officer manually
-- flipped `is_active`. These columns let officers pre-schedule the window so
-- check-in opens and closes automatically without anyone toggling it live.

alter table public.meetings
  add column if not exists session_start timestamptz,
  add column if not exists session_end   timestamptz;

-- A member can now check in when the session is manually active OR when "now"
-- falls inside the scheduled window. Mirrors `isSessionOpen()` on the client.
drop policy if exists "Users can check in to active meetings" on public.attendance;
create policy "Users can check in to active meetings"
  on public.attendance for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (
          m.is_active
          or (
            -- Only counts as scheduled-open when a bound was actually set.
            (m.session_start is not null or m.session_end is not null)
            and (m.session_start is null or now() >= m.session_start)
            and (m.session_end   is null or now() <= m.session_end)
          )
        )
    )
  );
