-- ============================================================================
-- announcements — SCI-managed posts surfaced on the public homepage
--
-- Created from the Edit Site dashboard tool. Published announcements are
-- readable by anyone (incl. anonymous homepage visitors); drafts and all
-- management are restricted to roles holding the `edit_site` permission.
--
-- This migration also introduces a reusable SQL counterpart to the frontend
-- `hasPermission(key)` helper: `public.has_permission(text)`. It reads the
-- caller's role permissions jsonb (admins implicitly pass) so RLS can gate on
-- any permission key consistently, mirroring the app layer.
-- ============================================================================

-- has_permission(key): mirror of the frontend hasPermission(). Admin tier
-- passes every check; otherwise the role's permissions jsonb must have the key
-- set to true. A missing role denies everything.
create or replace function public.has_permission(perm_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and (
        coalesce(r.is_admin, false)
        or coalesce((r.permissions ->> perm_key)::boolean, false)
      )
  );
$$;

create table if not exists public.announcements (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text        not null default '',
  is_published boolean     not null default false,
  created_by   uuid        references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Newest first, and a partial index for the common public "published" read.
create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);
create index if not exists announcements_published_idx
  on public.announcements (created_at desc)
  where is_published;

-- Keep updated_at fresh on edits (publish/unpublish, title/body changes).
create or replace function public.touch_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.touch_announcements_updated_at();

alter table public.announcements enable row level security;

-- Anyone (incl. anonymous homepage visitors) can read published announcements.
create policy "Anyone can view published announcements"
  on public.announcements for select
  to anon, authenticated
  using (is_published);

-- edit_site holders can read every announcement, including drafts.
create policy "Editors can view all announcements"
  on public.announcements for select
  to authenticated
  using (public.has_permission('edit_site'));

-- edit_site holders can create / update / delete announcements.
create policy "Editors can manage announcements"
  on public.announcements for all
  to authenticated
  using (public.has_permission('edit_site'))
  with check (public.has_permission('edit_site'));
