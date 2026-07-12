-- ============================================================================
-- Generalize tasks so an assignment targets a committee OR an individual member.
--
-- Assignment authoring moves out of Admin's committee-tasks tab into a dedicated
-- Assignments console. To keep a single source of truth (and preserve every
-- existing committee task + submission), we generalize the existing
-- `committee_tasks` table instead of adding a parallel one — the table keeps its
-- name, but `committee_id` becomes optional and a new `assignee_id` targets a
-- person. Exactly one target is set per task (committee XOR individual); the
-- type is derived from which FK is non-null, so no redundant `target_type`
-- column is kept in sync.
--
-- Submissions stay in the one `committee_task_submissions` table for both target
-- types; the frontend renders them contextually (committee tasks in the
-- committee dashboard, individual tasks on the member's profile).
--
-- Authoring is gated by a NEW `manage_assignments` permission (an officer action
-- distinct from committee management). Individual tasks/submissions are private
-- to the assignee + assigning officers; committee tasks stay member-visible so
-- the committee page keeps working.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply this to the
-- hosted DB manually. The committee-task-file-url Edge Function is unchanged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema: make committee_id optional, add the individual target, enforce XOR.
-- Existing rows all have committee_id set and assignee_id null, which satisfies
-- the constraint — no data migration needed.
-- ----------------------------------------------------------------------------
alter table public.committee_tasks
  alter column committee_id drop not null,
  add column if not exists assignee_id uuid
    references public.profiles (id) on delete cascade;

alter table public.committee_tasks
  drop constraint if exists committee_tasks_one_target;
alter table public.committee_tasks
  add constraint committee_tasks_one_target check (
    (committee_id is not null and assignee_id is null)
    or (committee_id is null and assignee_id is not null)
  );

create index if not exists committee_tasks_assignee_idx
  on public.committee_tasks (assignee_id, created_at desc);

-- Assigning officers need to read every profile to pick an individual assignee
-- and to show submitter names, independent of whether they're meeting "staff"
-- (the existing profiles SELECT policies cover own/admin/is_staff only).
drop policy if exists "Assignment officers can view all profiles" on public.profiles;
create policy "Assignment officers can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.has_permission('manage_assignments'));

-- ----------------------------------------------------------------------------
-- Seed the new `manage_assignments` permission into every role. Grant it wherever
-- `manage_committees` is already granted so existing committee managers keep the
-- ability to author committee tasks; admins pass every check regardless of jsonb.
-- ----------------------------------------------------------------------------
update public.roles
set permissions = coalesce(permissions, '{}'::jsonb) || jsonb_build_object(
  'manage_assignments',
  coalesce((permissions ->> 'manage_committees')::boolean, false)
);

-- ----------------------------------------------------------------------------
-- committee_tasks RLS — rewrite to cover both target types.
-- ----------------------------------------------------------------------------
-- SELECT: committee tasks stay visible to all members (the committee dashboard
-- lists them); individual tasks are private to the assignee + assigning officers.
drop policy if exists "Members can view committee tasks" on public.committee_tasks;
create policy "Members can view tasks"
  on public.committee_tasks for select
  to authenticated
  using (
    committee_id is not null
    or assignee_id = auth.uid()
    or public.has_permission('manage_assignments')
  );

-- INSERT/UPDATE/DELETE: assigning officers only — all authoring lives in the
-- Assignments console now, for both committee and individual targets.
drop policy if exists "Managers can manage committee tasks" on public.committee_tasks;
create policy "Officers can manage tasks"
  on public.committee_tasks for all
  to authenticated
  using (public.has_permission('manage_assignments'))
  with check (public.has_permission('manage_assignments'));

-- ----------------------------------------------------------------------------
-- committee_task_submissions RLS — extend to individual tasks.
-- ----------------------------------------------------------------------------
-- SELECT: assigning officers and your own submissions always; committee-task
-- submissions stay member-visible; individual-task submissions are visible to
-- that task's assignee.
drop policy if exists "Members can view committee task submissions" on public.committee_task_submissions;
create policy "Members can view task submissions"
  on public.committee_task_submissions for select
  to authenticated
  using (
    public.has_permission('manage_assignments')
    or submitted_by = auth.uid()
    or exists (
      select 1 from public.committee_tasks t
      where t.id = committee_task_submissions.task_id
        and t.committee_id is not null
    )
    or exists (
      select 1 from public.committee_tasks t
      where t.id = committee_task_submissions.task_id
        and t.assignee_id = auth.uid()
    )
  );

-- INSERT: submit only as yourself, and only against a task you belong to — a
-- committee you're on, or an individual task assigned to you (officers may too).
drop policy if exists "Committee members can submit task work" on public.committee_task_submissions;
create policy "Members can submit task work"
  on public.committee_task_submissions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.has_permission('manage_assignments')
      or public.has_permission('manage_committees')
      or exists (
        select 1
        from public.committee_members cm
        join public.committee_tasks t on t.committee_id = cm.committee_id
        where t.id = committee_task_submissions.task_id
          and cm.member_id = auth.uid()
      )
      or exists (
        select 1 from public.committee_tasks t
        where t.id = committee_task_submissions.task_id
          and t.assignee_id = auth.uid()
      )
    )
  );

-- DELETE: the submitter, a committee manager, or an assigning officer.
drop policy if exists "Submitters or managers delete task submissions" on public.committee_task_submissions;
create policy "Submitters or officers delete task submissions"
  on public.committee_task_submissions for delete
  to authenticated
  using (
    submitted_by = auth.uid()
    or public.has_permission('manage_committees')
    or public.has_permission('manage_assignments')
  );

-- ----------------------------------------------------------------------------
-- Storage `committee-task-files` — individual assignees may not belong to any
-- committee, so the old "member of some committee" upload gate would lock them
-- out. Replace it with a folder-scoped check: a caller may upload only into
-- their own `<uploader_id>/…` prefix (the path convention already used), which
-- is both broad enough for assignees and tighter than the previous rule.
-- ----------------------------------------------------------------------------
drop policy if exists "Committee members can upload to committee-task-files bucket" on storage.objects;
create policy "Members can upload to their own committee-task-files folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'committee-task-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners or committee managers delete committee-task-file objects" on storage.objects;
create policy "Owners or officers delete committee-task-file objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'committee-task-files'
    and (
      owner = auth.uid()
      or public.has_permission('manage_committees')
      or public.has_permission('manage_assignments')
    )
  );
