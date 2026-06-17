-- Restrict committee report submission to designated members of the committee.
--
-- Originally any signed-in member could file a report against any committee.
-- The intent is that only members assigned to a committee (or `manage_committees`
-- holders, who administer all committees) may submit its reports.
--
-- committee_members.member_id references profiles.id, which equals auth.uid(),
-- so we can match the caller directly against the roster.

drop policy if exists "Members can submit committee reports" on public.committee_reports;

create policy "Committee members can submit committee reports"
  on public.committee_reports for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.has_permission('manage_committees')
      or exists (
        select 1 from public.committee_members cm
        where cm.committee_id = committee_reports.committee_id
          and cm.member_id = auth.uid()
      )
    )
  );

-- Storage uploads can't be tied to a specific committee from the object path
-- (path is `<uploader_id>/<file>`), but we can still bar non-members entirely:
-- a caller may upload only if they belong to at least one committee or manage
-- committees. The per-committee gate above remains the authoritative check.
drop policy if exists "Members can upload to committee-reports bucket" on storage.objects;

create policy "Committee members can upload to committee-reports bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'committee-reports'
    and (
      public.has_permission('manage_committees')
      or exists (
        select 1 from public.committee_members cm
        where cm.member_id = auth.uid()
      )
    )
  );
