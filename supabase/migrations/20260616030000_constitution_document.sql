-- ============================================================================
-- SGA Constitution document
--
-- Surfaces a school constitution that anyone (including anonymous visitors on
-- the Join page) can read before applying. Admins set the current version from
-- the Admin panel either by pasting a link or uploading a file; both resolve to
-- a single public URL stored on site_settings.
--
--   site_settings.constitution_url — link or public storage URL (nullable).
--   storage bucket `documents`      — public-read, written by edit_site officers
--                                     (the same permission that owns the Join
--                                     SGA admin tab).
-- ============================================================================

alter table public.site_settings
  add column if not exists constitution_url text;

-- ----------------------------------------------------------------------------
-- Public `documents` bucket for uploaded files like the constitution PDF.
-- Public so the file is served via its public URL to members and visitors;
-- only edit_site officers may upload / replace / delete objects.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Idempotent: drop-then-create so this migration can be re-applied cleanly if a
-- prior partial run already created the bucket but not all policies.
drop policy if exists "Site editors can upload documents" on storage.objects;
create policy "Site editors can upload documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and public.has_permission('edit_site'));

drop policy if exists "Site editors can update documents" on storage.objects;
create policy "Site editors can update documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documents' and public.has_permission('edit_site'))
  with check (bucket_id = 'documents' and public.has_permission('edit_site'));

drop policy if exists "Site editors can delete documents" on storage.objects;
create policy "Site editors can delete documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and public.has_permission('edit_site'));
