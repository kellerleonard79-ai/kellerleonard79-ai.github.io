-- ============================================================================
-- Admin Settings panel support
--
-- Adds the few remaining configurable columns the Admin Settings hub needs and
-- the public `branding` storage bucket for the school logo upload. Most of the
-- columns the panel edits (logo_url, primary/accent/bg colors, join_form_schema,
-- quorum_type, quorum_custom_value) already exist from the foundation migration
-- (20260607030000); this migration only fills the gaps:
--   * site_settings.default_meeting_title_format
--   * profiles.custom_fields (stores values for custom Join SGA fields)
--   * a public `branding` storage bucket
--   * handle_new_user() copies custom_fields from signup metadata
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. site_settings: default meeting title format (supports a {date} token).
-- ----------------------------------------------------------------------------
alter table public.site_settings
  add column if not exists default_meeting_title_format text
    not null default 'SGA Meeting – {date}';

-- ----------------------------------------------------------------------------
-- 2. profiles: custom_fields jsonb for values of admin-defined Join SGA fields.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 3. Teach handle_new_user() to copy custom_fields from signup metadata.
--    Mirrors the latest definition (20260608070000) and only adds custom_fields.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user  boolean;
  admin_role_id  uuid;
  member_role_id uuid;
begin
  lock table public.profiles in exclusive mode;

  select not exists (select 1 from public.profiles) into is_first_user;

  select id into admin_role_id  from public.roles where is_admin order by "order" desc limit 1;
  select id into member_role_id from public.roles where name = 'General Member' limit 1;

  insert into public.profiles (
    id, student_id, full_name, grade_level, shirt_size, email,
    clearance_level, role_id, status, is_candidate_application, custom_fields
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'grade_level', '')::integer,
    new.raw_user_meta_data ->> 'shirt_size',
    new.email,
    case when is_first_user then 'admin' else 'member' end,
    case when is_first_user then admin_role_id else member_role_id end,
    case when is_first_user then 'active' else 'pending' end,
    coalesce((new.raw_user_meta_data ->> 'is_candidate_application')::boolean, false),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'custom_fields', '')::jsonb,
      '{}'::jsonb
    )
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Public `branding` storage bucket for the school logo.
--    Public bucket so the logo is served via its public URL site-wide; only
--    admins (manage_roles) may upload / replace / delete the object.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "Admins can upload branding objects"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'branding' and public.has_permission('manage_roles'));

create policy "Admins can update branding objects"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'branding' and public.has_permission('manage_roles'))
  with check (bucket_id = 'branding' and public.has_permission('manage_roles'));

create policy "Admins can delete branding objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'branding' and public.has_permission('manage_roles'));
