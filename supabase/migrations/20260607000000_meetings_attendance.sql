-- ============================================================================
-- Meetings & Attendance tracking module
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.meetings (
  id         uuid        primary key default gen_random_uuid(),
  date       date        not null,
  title      text        not null,
  agenda     text,
  is_active  boolean     not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id            uuid        primary key default gen_random_uuid(),
  meeting_id    uuid        not null references public.meetings (id) on delete cascade,
  profile_id    uuid        not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (meeting_id, profile_id)
);

create index if not exists attendance_meeting_id_idx on public.attendance (meeting_id);

-- ----------------------------------------------------------------------------
-- 2. Staff check helper (admin OR officer). SECURITY DEFINER avoids RLS
--    recursion when used inside policies.
-- ----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and clearance_level in ('admin', 'officer')
  );
$$;

-- Staff need to read every profile to compute quorum (total registered count).
create policy "Staff can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_staff());

-- ----------------------------------------------------------------------------
-- 3. RLS — meetings
-- ----------------------------------------------------------------------------
alter table public.meetings enable row level security;

-- Any signed-in user can read meetings (needed to load the active meeting and
-- the check-in screen).
create policy "Authenticated can view meetings"
  on public.meetings for select
  to authenticated
  using (true);

-- Only staff can create / edit / delete meetings.
create policy "Staff can manage meetings"
  on public.meetings for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- 4. RLS — attendance
-- ----------------------------------------------------------------------------
alter table public.attendance enable row level security;

-- A user checks themselves in, and only to a meeting that is currently active.
create policy "Users can check in to active meetings"
  on public.attendance for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.meetings
      where id = meeting_id and is_active
    )
  );

-- A user can see their own attendance rows.
create policy "Users can view own attendance"
  on public.attendance for select
  to authenticated
  using (auth.uid() = profile_id);

-- Staff can see and manage all attendance (for the live quorum / roster).
create policy "Staff can view all attendance"
  on public.attendance for select
  to authenticated
  using (public.is_staff());

create policy "Staff can manage attendance"
  on public.attendance for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- 5. Realtime — let the dashboard receive live check-ins.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end $$;
