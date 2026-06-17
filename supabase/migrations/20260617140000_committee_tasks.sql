-- ============================================================================
-- committee_tasks — assignments an admin gives to a committee, with member
-- submissions (text and/or file). Mirrors the committee_reports design:
--
--   * Tasks are authored by `manage_committees` holders and assigned to one
--     committee. A task has a title, an optional description, and an optional
--     due date (null = no due date).
--   * Any committee member (or a committee manager) may submit work toward a
--     task — text, an uploaded file, or both, exactly like committee_reports.
--   * Submission files live in the private `committee-task-files` bucket and are
--     opened through service-role signed URLs minted by the
--     `committee-task-file-url` Edge Function — the raw object path is never
--     sent to clients (a `has_file` generated flag is selected instead).
--
-- Both the admin panel and the committee dashboard read tasks + submissions, so
-- SELECT is open to any authenticated member (same posture as committee_members
-- and committee_reports). Writes are gated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- committee_tasks
-- ----------------------------------------------------------------------------
create table if not exists public.committee_tasks (
  id           uuid        primary key default gen_random_uuid(),
  committee_id uuid        not null references public.committees (id) on delete cascade,
  title        text        not null,
  description  text        not null default '',
  due_date     date,        -- null = no due date
  created_by   uuid        references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists committee_tasks_committee_idx
  on public.committee_tasks (committee_id, created_at desc);

alter table public.committee_tasks enable row level security;

-- SELECT: any authenticated member can see committee tasks (committee dashboard
-- shows them to all members; the admin panel lists them too).
create policy "Members can view committee tasks"
  on public.committee_tasks for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: committee managers only.
create policy "Managers can manage committee tasks"
  on public.committee_tasks for all
  to authenticated
  using (public.has_permission('manage_committees'))
  with check (public.has_permission('manage_committees'));

-- ----------------------------------------------------------------------------
-- committee_task_submissions — a member's submission toward a task: text, an
-- uploaded file, or both, but never neither (mirrors committee_reports).
-- ----------------------------------------------------------------------------
create table if not exists public.committee_task_submissions (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        not null references public.committee_tasks (id) on delete cascade,
  submitted_by uuid        references public.profiles (id) on delete set null,
  body         text,
  file_url     text,        -- raw storage object path (private); never sent to clients
  created_at   timestamptz not null default now(),
  -- At least one of body / file_url must be present.
  constraint committee_task_submissions_has_content check (
    body is not null or file_url is not null
  ),
  -- Presence flag the frontend selects instead of the raw path.
  has_file     boolean     generated always as (file_url is not null) stored
);

create index if not exists committee_task_submissions_task_idx
  on public.committee_task_submissions (task_id, created_at desc);

alter table public.committee_task_submissions enable row level security;

-- SELECT: any authenticated member can read submissions (visible from both the
-- admin panel and the committee section, per spec).
create policy "Members can view committee task submissions"
  on public.committee_task_submissions for select
  to authenticated
  using (true);

-- INSERT: a signed-in member may submit only as themselves, and only against a
-- task on a committee they belong to (or if they manage committees). Mirrors the
-- committee_reports submission gate.
create policy "Committee members can submit task work"
  on public.committee_task_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.has_permission('manage_committees')
      or exists (
        select 1
        from public.committee_members cm
        join public.committee_tasks t on t.committee_id = cm.committee_id
        where t.id = committee_task_submissions.task_id
          and cm.member_id = auth.uid()
      )
    )
  );

-- DELETE: the submitter, or a committee manager.
create policy "Submitters or managers delete task submissions"
  on public.committee_task_submissions for delete
  to authenticated
  using (
    submitted_by = auth.uid() or public.has_permission('manage_committees')
  );

-- ----------------------------------------------------------------------------
-- Private `committee-task-files` storage bucket + object policies.
-- File reads go through service-role signed URLs (Edge Function), so no SELECT
-- policy is needed. A caller may upload only if they belong to at least one
-- committee or manage committees (the per-task gate above is authoritative,
-- but the object path is `<uploader_id>/<file>` and can't be tied to a task);
-- uploaders or managers may delete.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('committee-task-files', 'committee-task-files', false)
on conflict (id) do nothing;

create policy "Committee members can upload to committee-task-files bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'committee-task-files'
    and (
      public.has_permission('manage_committees')
      or exists (
        select 1 from public.committee_members cm
        where cm.member_id = auth.uid()
      )
    )
  );

create policy "Owners or committee managers delete committee-task-file objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'committee-task-files'
    and (owner = auth.uid() or public.has_permission('manage_committees'))
  );
