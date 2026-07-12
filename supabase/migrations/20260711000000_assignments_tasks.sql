-- ============================================================================
-- Assignments: one task system, one submission mechanism.
--
-- An assignment is a task plus an explicit SET of assignees, resolved at
-- creation time (task_assignees). "Assign to the Events Committee" or "assign
-- to all seniors" are just picker shortcuts that populate that set — the officer
-- can deselect anyone before saving, which is impossible to express as a
-- committee/grade foreign key. Consequences that are intentional:
--
--   * SNAPSHOT semantics: joining a committee later does NOT inherit its open
--     tasks. Officers add/remove assignees on an existing task instead.
--   * `tasks.committee_id` is display context only (grouping "My committees" on
--     the Assignments page). It is never the assignment mechanism, and deleting
--     a committee keeps its tasks alive (on delete set null).
--   * `requires_each`: true = complete when EVERY assignee has submitted;
--     false = complete when ANY ONE assignee submits.
--
-- Reports are deleted as a concept — a submission already carries body text and
-- an optional file, so "assigning a report" is just assigning a task. This
-- migration therefore SUPERSEDES AND DROPS:
--   * committee_tasks + committee_task_submissions (rows are migrated below:
--     committee tasks get the committee's current roster as their assignee
--     snapshot, and submissions carry over with their original ids so stored
--     file paths keep working)
--   * committee_reports + the committee-reports bucket (NOT migrated — report
--     rows were judged test data; export them first if any are real)
--
-- The private `committee-task-files` bucket is kept as the submission-file
-- bucket (renaming a bucket would orphan its stored objects); files are opened
-- through the `task-file-url` Edge Function, which replaces both
-- `committee-task-file-url` and `committee-report-url`.
--
-- Authoring is gated by a NEW `assign_tasks` permission (checked in RLS via
-- has_permission, mirroring the frontend). This replaces the short-lived
-- `manage_assignments` key from the unmerged 20260618 migration; every step
-- here is guarded so it applies cleanly whether or not that one ever ran.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  description   text        not null default '',
  due_date      date,        -- null = no due date
  -- true: every assignee must submit; false: any one submission completes it.
  requires_each boolean     not null default false,
  -- Display/grouping context only — never the assignment mechanism.
  committee_id  uuid        references public.committees (id) on delete set null,
  created_by    uuid        references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists tasks_committee_idx
  on public.tasks (committee_id, created_at desc);

-- The resolved assignee set. PK doubles as the "one row per member" guarantee.
create table if not exists public.task_assignees (
  task_id   uuid        not null references public.tasks (id) on delete cascade,
  member_id uuid        not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (task_id, member_id)
);

create index if not exists task_assignees_member_idx
  on public.task_assignees (member_id);

-- A submission is text, an uploaded file, or both, but never neither.
create table if not exists public.task_submissions (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks (id) on delete cascade,
  member_id  uuid        references public.profiles (id) on delete set null,
  body       text,
  file_url   text,        -- raw storage object path (private); never sent to clients
  created_at timestamptz not null default now(),
  constraint task_submissions_has_content check (
    body is not null or file_url is not null
  ),
  -- Presence flag the frontend selects instead of the raw path.
  has_file   boolean     generated always as (file_url is not null) stored
);

create index if not exists task_submissions_task_idx
  on public.task_submissions (task_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. SECURITY DEFINER helpers — policies on task_assignees can't query
--    task_assignees themselves (recursive-policy trap, same reason is_admin()
--    exists), so membership checks go through these.
-- ----------------------------------------------------------------------------
create or replace function public.is_task_assignee(t_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = t_id and member_id = auth.uid()
  );
$$;

-- Do the caller and `other` appear together on at least one task? Lets plain
-- members read the names of teammates on shared tasks ("Alice already
-- submitted") without widening profiles access any further.
create or replace function public.shares_task_with(other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.task_assignees mine
    join public.task_assignees theirs on theirs.task_id = mine.task_id
    where mine.member_id = auth.uid() and theirs.member_id = other
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Seed the `assign_tasks` permission and retire `manage_assignments`.
--    Default grant is "Class Officer and above": expressed through permissions
--    the officer tiers already hold (edit_agendas / create_meetings /
--    manage_committees) rather than by role NAME, since tiers are renameable.
--    manage_committees is lifted to the same tiers (grant-only — nothing is
--    revoked from live roles). Admin tiers pass every check regardless.
-- ----------------------------------------------------------------------------
update public.roles
set permissions = (coalesce(permissions, '{}'::jsonb) - 'manage_assignments')
  || jsonb_build_object(
    'assign_tasks',
    coalesce((permissions ->> 'manage_committees')::boolean, false)
      or coalesce((permissions ->> 'edit_agendas')::boolean, false)
      or coalesce((permissions ->> 'create_meetings')::boolean, false),
    'manage_committees',
    coalesce((permissions ->> 'manage_committees')::boolean, false)
      or coalesce((permissions ->> 'edit_agendas')::boolean, false)
      or coalesce((permissions ->> 'create_meetings')::boolean, false)
  );

-- Same key swap for any per-member overrides that referenced the old name.
update public.profiles
set permission_overrides =
  (permission_overrides - 'manage_assignments')
  || case
       when permission_overrides ? 'manage_assignments'
       then jsonb_build_object(
         'assign_tasks', (permission_overrides ->> 'manage_assignments')::boolean
       )
       else '{}'::jsonb
     end
where permission_overrides ? 'manage_assignments';

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_submissions enable row level security;

-- Tasks are visible to their assignees and to assigning officers — nobody else.
create policy "Assignees and officers can view tasks"
  on public.tasks for select
  to authenticated
  using (
    public.is_task_assignee(id)
    or public.has_permission('assign_tasks')
  );

create policy "Officers can manage tasks"
  on public.tasks for all
  to authenticated
  using (public.has_permission('assign_tasks'))
  with check (public.has_permission('assign_tasks'));

-- Assignees see the full set for their own tasks (needed to show "2 of 5
-- submitted" and who's on the hook); officers see everything.
create policy "Assignees and officers can view task assignees"
  on public.task_assignees for select
  to authenticated
  using (
    public.is_task_assignee(task_id)
    or public.has_permission('assign_tasks')
  );

create policy "Officers can manage task assignees"
  on public.task_assignees for all
  to authenticated
  using (public.has_permission('assign_tasks'))
  with check (public.has_permission('assign_tasks'));

-- Co-assignees must see each other's submissions — on a requires_each = false
-- task, that's the only thing stopping three people doing the same job.
create policy "Assignees and officers can view task submissions"
  on public.task_submissions for select
  to authenticated
  using (
    member_id = auth.uid()
    or public.is_task_assignee(task_id)
    or public.has_permission('assign_tasks')
  );

-- Submit only as yourself, only against a task you're assigned to. This is THE
-- submission mechanism for the whole app — nothing else accepts work.
create policy "Assignees can submit task work"
  on public.task_submissions for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and public.is_task_assignee(task_id)
  );

create policy "Submitters or officers delete task submissions"
  on public.task_submissions for delete
  to authenticated
  using (
    member_id = auth.uid()
    or public.has_permission('assign_tasks')
  );

-- Assigning officers need every profile (the People picker, group chips, and
-- submitter names), independent of the staff/admin SELECT policies. Plain
-- members additionally get the profiles of people who share a task with them.
drop policy if exists "Assignment officers can view all profiles" on public.profiles;
create policy "Assigning officers can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.has_permission('assign_tasks'));

create policy "Members can view co-assignee profiles"
  on public.profiles for select
  to authenticated
  using (public.shares_task_with(id));

-- ----------------------------------------------------------------------------
-- 5. Migrate committee_tasks / committee_task_submissions, then drop them.
--    Guarded so it works whether or not the unmerged 20260618 migration (which
--    added an assignee_id column) was ever applied.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.committee_tasks') is not null then
    -- Committee tasks: keep committee context; snapshot = the committee's
    -- CURRENT roster. requires_each = false matches the old "anyone on the
    -- committee submits" behavior. Original ids are preserved.
    insert into public.tasks
      (id, title, description, due_date, requires_each, committee_id, created_by, created_at)
    select id, title, description, due_date, false, committee_id, created_by, created_at
    from public.committee_tasks
    where committee_id is not null
    on conflict (id) do nothing;

    insert into public.task_assignees (task_id, member_id)
    select t.id, cm.member_id
    from public.committee_tasks t
    join public.committee_members cm on cm.committee_id = t.committee_id
    where t.committee_id is not null
    on conflict do nothing;

    -- Individual tasks only exist if 20260618 ran.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'committee_tasks'
        and column_name = 'assignee_id'
    ) then
      insert into public.tasks
        (id, title, description, due_date, requires_each, committee_id, created_by, created_at)
      select id, title, description, due_date, true, null, created_by, created_at
      from public.committee_tasks
      where committee_id is null
      on conflict (id) do nothing;

      insert into public.task_assignees (task_id, member_id)
      select id, assignee_id
      from public.committee_tasks
      where committee_id is null and assignee_id is not null
      on conflict do nothing;
    end if;

    -- Submissions carry over 1:1; ids preserved so `<uploader>/…` file paths in
    -- committee-task-files stay reachable through the new Edge Function.
    insert into public.task_submissions (id, task_id, member_id, body, file_url, created_at)
    select s.id, s.task_id, s.submitted_by, s.body, s.file_url, s.created_at
    from public.committee_task_submissions s
    where exists (select 1 from public.tasks t where t.id = s.task_id)
    on conflict (id) do nothing;

    drop table public.committee_task_submissions;
    drop table public.committee_tasks;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Reports are gone as a concept: drop committee_reports and its bucket.
--    (Bucket object rows are removed so the bucket row can be deleted; the
--    physical files are orphaned — acceptable for test data, export first if
--    anything in there is real.)
-- ----------------------------------------------------------------------------
drop table if exists public.committee_reports;

drop policy if exists "Members can upload to committee-reports bucket" on storage.objects;
drop policy if exists "Owners or committee managers delete committee-report objects" on storage.objects;
delete from storage.objects where bucket_id = 'committee-reports';
delete from storage.buckets where id = 'committee-reports';

-- ----------------------------------------------------------------------------
-- 7. committee-task-files bucket policies — rewritten for the new gate. Upload
--    is folder-scoped to the caller's own `<uploader_id>/…` prefix (the path
--    convention the frontend already uses), which covers assignees who belong
--    to no committee and is tighter than the old roster-membership rule.
-- ----------------------------------------------------------------------------
drop policy if exists "Committee members can upload to committee-task-files bucket" on storage.objects;
drop policy if exists "Members can upload to their own committee-task-files folder" on storage.objects;
create policy "Members can upload to their own committee-task-files folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'committee-task-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners or committee managers delete committee-task-file objects" on storage.objects;
drop policy if exists "Owners or officers delete committee-task-file objects" on storage.objects;
create policy "Owners or officers delete committee-task-file objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'committee-task-files'
    and (owner = auth.uid() or public.has_permission('assign_tasks'))
  );
