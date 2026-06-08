-- ============================================================================
-- archives — document/resource library with tier-gated visibility.
--
-- Each item is either a file stored in the private `archives` storage bucket
-- (referenced by `file_url`, the raw object path) or an external Drive link.
-- Visibility is gated by role.order: a viewer must hold a role whose `order`
-- is >= the item's `visibility_min_role_order` to see it. Uploaders can only
-- restrict an item down to their own tier — never above it — which is enforced
-- both in the upload UI and in the INSERT RLS WITH CHECK.
--
-- The raw storage path (`file_url`) is never read by the frontend: the list
-- selects the generated `has_file` boolean instead, and the `archive-file-url`
-- Edge Function mints short-lived signed URLs server-side on demand.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- current_role_order(): the caller's role.order, used by the visibility gate.
-- Mirrors the frontend's `profile.role.order`. Returns null for users with no
-- role (callers should coalesce to 0).
-- ----------------------------------------------------------------------------
create or replace function public.current_role_order()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select r."order"
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- archive_items
-- ----------------------------------------------------------------------------
create table if not exists public.archive_items (
  id                       uuid        primary key default gen_random_uuid(),
  title                    text        not null,
  description              text        not null default '',
  category                 text        not null default '',
  tags                     text[]      not null default '{}',
  folder_path              text        not null default '',
  file_url                 text,        -- raw storage object path (private); never sent to clients
  drive_link               text,
  visibility_min_role_order integer    not null default 0,
  uploaded_by              uuid        references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  -- Exactly one source: a stored file OR a Drive link, not both, not neither.
  constraint archive_items_one_source check (
    (file_url is not null and drive_link is null) or
    (file_url is null and drive_link is not null)
  ),
  -- Presence flag the frontend selects instead of the raw path.
  has_file                 boolean     generated always as (file_url is not null) stored
);

create index if not exists archive_items_folder_idx
  on public.archive_items (folder_path);
create index if not exists archive_items_created_at_idx
  on public.archive_items (created_at desc);
create index if not exists archive_items_tags_idx
  on public.archive_items using gin (tags);

alter table public.archive_items enable row level security;

-- SELECT: visible only when the viewer's role.order meets the item threshold.
create policy "Members can view permitted archive items"
  on public.archive_items for select
  to authenticated
  using (coalesce(public.current_role_order(), 0) >= visibility_min_role_order);

-- INSERT: any signed-in member, but they must own the row and may only set a
-- threshold at or below their own tier (cannot hide from tiers above them).
create policy "Members can upload archive items"
  on public.archive_items for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and visibility_min_role_order <= coalesce(public.current_role_order(), 0)
  );

-- UPDATE/DELETE: the original uploader or an archive admin (manage_committees).
create policy "Owners or committee managers update archive items"
  on public.archive_items for update
  to authenticated
  using (uploaded_by = auth.uid() or public.has_permission('manage_committees'))
  with check (uploaded_by = auth.uid() or public.has_permission('manage_committees'));

create policy "Owners or committee managers delete archive items"
  on public.archive_items for delete
  to authenticated
  using (uploaded_by = auth.uid() or public.has_permission('manage_committees'));

-- ----------------------------------------------------------------------------
-- Private `archives` storage bucket + object policies.
-- File reads happen through service-role signed URLs (Edge Function), so no
-- SELECT policy is needed; members may upload, and owners/admins may delete.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('archives', 'archives', false)
on conflict (id) do nothing;

create policy "Members can upload to archives bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'archives');

create policy "Owners or committee managers delete archive objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'archives'
    and (owner = auth.uid() or public.has_permission('manage_committees'))
  );
