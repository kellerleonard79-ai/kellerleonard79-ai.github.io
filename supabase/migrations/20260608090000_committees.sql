-- ============================================================================
-- committees — named groups with members, a designated chair, and reports.
--
-- Committees feed the public /about page, so `committees` itself is readable by
-- anonymous visitors. Membership and reports are internal: only authenticated
-- members can read them, and only `manage_committees` holders can edit the
-- committee roster. Reports can be filed by any signed-in member.
--
-- Anonymous /about reads go through the `public_committees` view, which joins
-- committees -> committee_members -> profiles and exposes ONLY public columns
-- (committee name/description, member name + elected-position title + photo,
-- chair flag) — never email, student_id, dues, etc. The base tables' RLS keeps
-- anon out of `committee_members`/`profiles`; the view (security_invoker = false)
-- runs with its owner's privileges so anon can read the curated projection.
--
-- Report files live in the private `committee-reports` storage bucket and are
-- opened through service-role signed URLs minted by the `committee-report-url`
-- Edge Function — the raw object path is never sent to clients, exactly like
-- archives.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- committees
-- ----------------------------------------------------------------------------
create table if not exists public.committees (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  description text        not null default '',
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists committees_created_at_idx
  on public.committees (created_at desc);

alter table public.committees enable row level security;

-- SELECT: public — anonymous /about visitors read committee name/description.
create policy "Anyone can view committees"
  on public.committees for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE: committee managers only.
create policy "Managers can manage committees"
  on public.committees for all
  to authenticated
  using (public.has_permission('manage_committees'))
  with check (public.has_permission('manage_committees'));

-- ----------------------------------------------------------------------------
-- committee_members — roster join. Chair is a flag; the "only one chair per
-- committee" rule is enforced in the UI, not the DB (per spec).
-- ----------------------------------------------------------------------------
create table if not exists public.committee_members (
  id           uuid        primary key default gen_random_uuid(),
  committee_id uuid        not null references public.committees (id) on delete cascade,
  member_id    uuid        not null references public.profiles (id) on delete cascade,
  is_chair     boolean     not null default false,
  joined_at    timestamptz not null default now(),
  unique (committee_id, member_id)
);

create index if not exists committee_members_committee_idx
  on public.committee_members (committee_id);
create index if not exists committee_members_member_idx
  on public.committee_members (member_id);

alter table public.committee_members enable row level security;

-- SELECT: any authenticated member can see committee rosters.
create policy "Members can view committee members"
  on public.committee_members for select
  to authenticated
  using (true);

-- INSERT/DELETE: committee managers only. (Chair toggles are UPDATEs, also
-- managers — covered by the FOR ALL policy below for symmetry.)
create policy "Managers can manage committee members"
  on public.committee_members for all
  to authenticated
  using (public.has_permission('manage_committees'))
  with check (public.has_permission('manage_committees'));

-- ----------------------------------------------------------------------------
-- committee_reports — a report is text, an uploaded file, or both, but never
-- neither. Files reference the raw path in the private `committee-reports`
-- bucket; that column is never sent to clients (see has_file generated flag).
-- ----------------------------------------------------------------------------
create table if not exists public.committee_reports (
  id           uuid        primary key default gen_random_uuid(),
  committee_id uuid        not null references public.committees (id) on delete cascade,
  submitted_by uuid        references public.profiles (id) on delete set null,
  body         text,
  file_url     text,        -- raw storage object path (private); never sent to clients
  created_at   timestamptz not null default now(),
  -- At least one of body / file_url must be present.
  constraint committee_reports_has_content check (
    body is not null or file_url is not null
  ),
  -- Presence flag the frontend selects instead of the raw path.
  has_file     boolean     generated always as (file_url is not null) stored
);

create index if not exists committee_reports_committee_idx
  on public.committee_reports (committee_id, created_at desc);

alter table public.committee_reports enable row level security;

-- SELECT: any authenticated member can read reports.
create policy "Members can view committee reports"
  on public.committee_reports for select
  to authenticated
  using (true);

-- INSERT: any signed-in member may file a report, but only as themselves.
create policy "Members can submit committee reports"
  on public.committee_reports for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- DELETE: the submitter, or a committee manager.
create policy "Submitters or managers delete committee reports"
  on public.committee_reports for delete
  to authenticated
  using (submitted_by = auth.uid() or public.has_permission('manage_committees'));

-- ----------------------------------------------------------------------------
-- public_committees — privacy-safe projection for the anonymous /about page.
-- One row per membership (committees with no members still surface via the
-- left join, with null member columns). Exposes ONLY public-facing columns.
-- security_invoker = false so it reads past base-table RLS for anon.
-- ----------------------------------------------------------------------------
create or replace view public.public_committees
with (security_invoker = false) as
select
  c.id                       as committee_id,
  c.name                     as committee_name,
  c.description              as committee_description,
  cm.id                      as membership_id,
  cm.is_chair,
  p.full_name                as member_name,
  p.photo_url                as member_photo_url,
  ep.title                   as member_position_title
from public.committees c
left join public.committee_members cm on cm.committee_id = c.id
left join public.profiles p           on p.id = cm.member_id
left join public.elected_positions ep on ep.id = p.elected_position_id;

grant select on public.public_committees to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Private `committee-reports` storage bucket + object policies.
-- File reads go through service-role signed URLs (Edge Function), so no SELECT
-- policy is needed; members may upload, and uploaders/managers may delete.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('committee-reports', 'committee-reports', false)
on conflict (id) do nothing;

create policy "Members can upload to committee-reports bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'committee-reports');

create policy "Owners or committee managers delete committee-report objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'committee-reports'
    and (owner = auth.uid() or public.has_permission('manage_committees'))
  );
