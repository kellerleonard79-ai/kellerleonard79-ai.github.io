-- ============================================================================
-- Application assets: endorsement uploads, settings copy, public candidate feed
--
-- Supports the election application checklist dashboard:
--   * a private `applications` storage bucket where an applicant uploads their
--     signed endorsement photo into their own user-id folder;
--   * admin-editable Markdown campaign rules + an endorsement-form download URL
--     on site_settings;
--   * get_public_candidates() — a privacy-safe feed for the public Elections
--     page (names + positions + provisional/qualified status only).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- site_settings: campaign rules (Markdown) shown in the Rules module, and the
-- endorsement form template applicants download in the Endorsements module.
-- ----------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists campaign_rules_md text,
  add column if not exists endorsement_form_url text;

-- ----------------------------------------------------------------------------
-- Private bucket for endorsement uploads. Files live under "<uid>/..." so each
-- applicant can only write within their own folder; elections managers can read
-- everything for verification.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('applications', 'applications', false)
on conflict (id) do nothing;

create policy "Applicants upload own endorsement"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Applicants read own endorsement"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'applications'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('manage_elections')
    )
  );

create policy "Applicants replace own endorsement"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Applicants delete own endorsement"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Public candidate feed. applicants RLS hides rows from everyone but the owner
-- and managers, so the public Elections page reads through this SECURITY
-- DEFINER function instead — exposing only display fields, never signatures,
-- emails, or fallback choices.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_candidates()
returns table (
  id             uuid,
  full_name      text,
  position_id    uuid,
  position_title text,
  status         text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, p.full_name, a.position_id, pos.title, a.status
  from public.applicants a
  join public.profiles p   on p.id = a.member_id
  left join public.positions pos on pos.id = a.position_id
  order by pos.title nulls last, p.full_name;
$$;

grant execute on function public.get_public_candidates() to anon, authenticated;
