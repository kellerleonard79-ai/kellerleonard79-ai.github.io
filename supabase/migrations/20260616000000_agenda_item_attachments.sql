-- ============================================================================
-- agenda_item_attachments — files, external links, and Archives references
-- attached to individual agenda items.
--
-- An attachment is exactly one of three kinds:
--   * 'archive' — a reference to an existing archive_items row. Opened through
--      the existing `archive-file-url` Edge Function (for stored files) or the
--      archive's drive_link, so the archive's own tier-gating is preserved.
--   * 'link'    — an arbitrary external URL (Google Doc, Drive, etc.).
--   * 'file'    — a file uploaded directly onto the agenda item, stored in the
--      PRIVATE `agenda-files` bucket and opened through the `agenda-file-url`
--      Edge Function, which signs the object only after the attachment row is
--      visible to the caller under the tier gate below.
--
-- Access control:
--   * Adding / editing / removing attachments requires the `edit_agendas`
--     permission (the agenda-editing tier).
--   * Each attachment carries `visibility_min_role_order`: a viewer must hold a
--     role whose `order` is >= that value to see (and open) it. Uploaders may
--     only restrict down to their own tier, never above it — enforced in the
--     INSERT/UPDATE WITH CHECK, mirroring archive_items.
-- ============================================================================

create table if not exists public.agenda_item_attachments (
  id                        uuid        primary key default gen_random_uuid(),
  item_id                   uuid        not null references public.agenda_items (id) on delete cascade,
  kind                      text        not null check (kind in ('archive', 'link', 'file')),
  archive_item_id           uuid        references public.archive_items (id) on delete cascade,
  link_url                  text,
  file_url                  text,        -- private storage object path in `agenda-files`
  label                     text        not null default '',
  visibility_min_role_order integer     not null default 0,
  position                  integer     not null default 0,
  created_by                uuid        references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  -- Exactly one source matching the declared kind.
  constraint agenda_attachment_one_source check (
    (kind = 'archive' and archive_item_id is not null and link_url is null and file_url is null) or
    (kind = 'link'    and link_url is not null and archive_item_id is null and file_url is null) or
    (kind = 'file'    and file_url is not null and archive_item_id is null and link_url is null)
  )
);

create index if not exists agenda_item_attachments_item_idx
  on public.agenda_item_attachments (item_id);

alter table public.agenda_item_attachments enable row level security;

-- SELECT for non-editors: gated by the viewer's role.order vs the threshold.
-- (Agenda editors additionally see everything via the manage policy below,
--  since RLS policies are permissive / OR-combined.)
create policy "Members view permitted agenda attachments"
  on public.agenda_item_attachments for select
  to authenticated
  using (coalesce(public.current_role_order(), 0) >= visibility_min_role_order);

-- INSERT / UPDATE / DELETE: requires edit_agendas. The threshold may only be set
-- at or below the editor's own tier, so they cannot hide an item from tiers above
-- themselves (admins pass because their role.order is the ceiling).
create policy "Agenda editors manage attachments"
  on public.agenda_item_attachments for all
  to authenticated
  using (public.has_permission('edit_agendas'))
  with check (
    public.has_permission('edit_agendas')
    and visibility_min_role_order <= coalesce(public.current_role_order(), 0)
  );

-- ----------------------------------------------------------------------------
-- Private `agenda-files` bucket for files uploaded directly onto agenda items.
-- File reads go through the service-role `agenda-file-url` Edge Function (which
-- re-checks row visibility), so no SELECT policy is needed here. Only agenda
-- editors may upload or delete objects.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('agenda-files', 'agenda-files', false)
on conflict (id) do nothing;

create policy "Agenda editors can upload to agenda-files bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'agenda-files' and public.has_permission('edit_agendas'));

create policy "Agenda editors can delete agenda-files objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'agenda-files' and public.has_permission('edit_agendas'));
