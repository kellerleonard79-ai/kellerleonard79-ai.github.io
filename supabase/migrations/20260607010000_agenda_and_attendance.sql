-- ============================================================================
-- Meetings module v2: agendas, richer meeting fields, attendance status/source
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extra meeting fields (agenda "Opening" + "Adjournment" data)
-- ----------------------------------------------------------------------------
alter table public.meetings
  add column if not exists presiding_officer text,
  add column if not exists called_to_order   timestamptz,
  add column if not exists quorum_confirmed   boolean not null default false,
  add column if not exists agenda_approved    boolean not null default false,
  add column if not exists next_meeting_date  date,
  add column if not exists adjourned_at       timestamptz;

-- ----------------------------------------------------------------------------
-- 2. Attendance: how present (status) and where it came from (source)
-- ----------------------------------------------------------------------------
alter table public.attendance
  add column if not exists status text not null default 'present',  -- present | excused | unexcused
  add column if not exists source text not null default 'qr';       -- qr | manual

-- ----------------------------------------------------------------------------
-- 3. Agenda items — sectioned, with optional sub-items (parent_id)
-- ----------------------------------------------------------------------------
create table if not exists public.agenda_items (
  id              uuid        primary key default gen_random_uuid(),
  meeting_id      uuid        not null references public.meetings (id) on delete cascade,
  parent_id       uuid        references public.agenda_items (id) on delete cascade,
  section         text        not null,  -- opening | unfinished | new | open_floor | adjournment | announcements | reports
  content         text        not null default '',
  status          text,                  -- free-form ("Approved", "Tabled", …)
  secretary_notes text,
  position        integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists agenda_items_meeting_idx on public.agenda_items (meeting_id);
create index if not exists agenda_items_parent_idx  on public.agenda_items (parent_id);

alter table public.agenda_items enable row level security;

create policy "Authenticated can view agenda items"
  on public.agenda_items for select
  to authenticated
  using (true);

create policy "Staff can manage agenda items"
  on public.agenda_items for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());
