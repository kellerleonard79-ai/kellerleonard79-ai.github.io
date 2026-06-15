-- ============================================================================
-- Nexus 2.0 foundation: DB-driven roles, elected positions, agenda section
-- types, and site settings.
--
-- This migration introduces the customizable foundation tables described in the
-- project plan WITHOUT touching the existing UI. It runs alongside the legacy
-- `clearance_level` / `position` text columns (which are intentionally kept for
-- now) so the app keeps working during the transition. `profiles` gains
-- `role_id` and `elected_position_id` FKs, the signup trigger is taught to set
-- `role_id`, and the RLS helpers `is_admin()` / `is_staff()` are upgraded to
-- read the new role permissions while still honouring `clearance_level`.
--
-- NB: `order` and `group` are reserved SQL keywords; they are the column names
-- requested by the schema, so they are double-quoted everywhere.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. roles — replaces the hardcoded clearance_level enum
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  "order"     integer     not null default 0,   -- higher = more access
  permissions jsonb       not null default '{}'::jsonb,
  is_admin    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- At most one role may be the top-level admin tier.
create unique index if not exists roles_single_admin_idx
  on public.roles (is_admin)
  where is_admin;

-- ----------------------------------------------------------------------------
-- 2. elected_positions — replaces the free-text profiles.position column
-- ----------------------------------------------------------------------------
create table if not exists public.elected_positions (
  id                 uuid        primary key default gen_random_uuid(),
  title              text        not null unique,
  "group"            text        not null default 'custom', -- exec | senior | junior | sophomore | freshman | custom
  "order"            integer     not null default 0,
  show_in_elections  boolean     not null default true,
  created_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. agenda_section_types — replaces the hardcoded agenda section keys
-- ----------------------------------------------------------------------------
create table if not exists public.agenda_section_types (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null unique,
  default_order integer     not null default 0,
  is_default    boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. site_settings — single-row global configuration
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
  id                  integer     primary key default 1,
  signup_enabled      boolean     not null default true,
  school_name         text        not null default 'Pensacola High School Student Government Association',
  tagline             text        not null default 'Home of the Tigers',
  logo_url            text,
  primary_color       text        not null default '#8e231c',
  accent_color        text        not null default '#c8a24a',
  bg_color            text        not null default '#ffffff',
  about_purpose_text  text        not null default 'The Pensacola High School Student Government Association represents every Tiger — building leadership, school spirit, and community.',
  quorum_type         text        not null default 'half_active', -- half_active | half_officers | custom
  quorum_custom_value integer,
  join_form_schema    jsonb       not null default '[]'::jsonb,
  -- Guard so this table can only ever hold the single row with id = 1.
  constraint site_settings_singleton check (id = 1)
);

-- ============================================================================
-- 5. Seed default data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5a. Five default roles. Permission keys are the fixed set from the plan.
--     Legacy clearance_level maps onto these as:
--       admin   -> SCI / Admin
--       officer -> Executive Officer
--       member  -> General Member
-- ----------------------------------------------------------------------------
insert into public.roles (name, "order", is_admin, permissions) values
  (
    'Applicant', 1, false,
    jsonb_build_object(
      'view_directory', false, 'edit_directory', false,
      'view_meetings', false, 'create_meetings', false, 'edit_agendas', false,
      'view_bookkeeping', false, 'manage_bookkeeping', false,
      'view_archives', false, 'upload_archives', false,
      'view_elections', false, 'manage_elections', false,
      'edit_site', false, 'manage_roles', false, 'manage_committees', false
    )
  ),
  (
    'General Member', 2, false,
    jsonb_build_object(
      'view_directory', true, 'edit_directory', false,
      'view_meetings', true, 'create_meetings', false, 'edit_agendas', false,
      'view_bookkeeping', false, 'manage_bookkeeping', false,
      'view_archives', true, 'upload_archives', true,
      'view_elections', false, 'manage_elections', false,
      'edit_site', false, 'manage_roles', false, 'manage_committees', false
    )
  ),
  (
    'Class Officer', 3, false,
    jsonb_build_object(
      'view_directory', true, 'edit_directory', false,
      'view_meetings', true, 'create_meetings', true, 'edit_agendas', true,
      'view_bookkeeping', false, 'manage_bookkeeping', false,
      'view_archives', true, 'upload_archives', true,
      'view_elections', false, 'manage_elections', false,
      'edit_site', false, 'manage_roles', false, 'manage_committees', false
    )
  ),
  (
    'Executive Officer', 4, false,
    jsonb_build_object(
      'view_directory', true, 'edit_directory', false,
      'view_meetings', true, 'create_meetings', true, 'edit_agendas', true,
      'view_bookkeeping', true, 'manage_bookkeeping', false,
      'view_archives', true, 'upload_archives', true,
      'view_elections', true, 'manage_elections', false,
      'edit_site', false, 'manage_roles', false, 'manage_committees', false
    )
  ),
  (
    'SCI / Admin', 5, true,
    jsonb_build_object(
      'view_directory', true, 'edit_directory', true,
      'view_meetings', true, 'create_meetings', true, 'edit_agendas', true,
      'view_bookkeeping', true, 'manage_bookkeeping', true,
      'view_archives', true, 'upload_archives', true,
      'view_elections', true, 'manage_elections', true,
      'edit_site', true, 'manage_roles', true, 'manage_committees', true
    )
  )
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 5b. Default elected positions, grouped by class / executive board.
-- ----------------------------------------------------------------------------
insert into public.elected_positions (title, "group", "order", show_in_elections) values
  ('Executive President',        'exec',      1, true),
  ('Executive Vice President',   'exec',      2, true),
  ('Executive Secretary',        'exec',      3, true),
  ('Executive Treasurer',        'exec',      4, true),
  ('Senior Class President',     'senior',    1, true),
  ('Senior Class Vice President','senior',    2, true),
  ('Senior Class Secretary',     'senior',    3, true),
  ('Senior Class Treasurer',     'senior',    4, true),
  ('Junior Class President',     'junior',    1, true),
  ('Junior Class Vice President','junior',    2, true),
  ('Junior Class Secretary',     'junior',    3, true),
  ('Junior Class Treasurer',     'junior',    4, true),
  ('Sophomore Class President',     'sophomore', 1, true),
  ('Sophomore Class Vice President','sophomore', 2, true),
  ('Sophomore Class Secretary',     'sophomore', 3, true),
  ('Sophomore Class Treasurer',     'sophomore', 4, true),
  ('Freshman Class President',     'freshman', 1, true),
  ('Freshman Class Vice President','freshman', 2, true),
  ('Freshman Class Secretary',     'freshman', 3, true),
  ('Freshman Class Treasurer',     'freshman', 4, true)
on conflict (title) do nothing;

-- ----------------------------------------------------------------------------
-- 5c. Seven default agenda section types (matches the current editor's order).
-- ----------------------------------------------------------------------------
insert into public.agenda_section_types (name, default_order, is_default) values
  ('Opening',              1, true),
  ('Announcements',        2, true),
  ('Reports',              3, true),
  ('Unfinished Business',  4, true),
  ('New Business',         5, true),
  ('Open Floor',           6, true),
  ('Adjournment',          7, true)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 5d. Default single-row site_settings. The join form schema mirrors the two
--     fields the current /join form collects (grade + shirt size).
-- ----------------------------------------------------------------------------
insert into public.site_settings (id, join_form_schema) values (
  1,
  '[
     {"key":"grade","type":"select","label":"Grade","enabled":true,"required":true,"options":["9","10","11","12"]},
     {"key":"shirt_size","type":"select","label":"Shirt Size","enabled":true,"required":true,"options":["XS","S","M","L","XL","XXL"]}
   ]'::jsonb
)
on conflict (id) do nothing;

-- ============================================================================
-- 6. profiles: add role_id + elected_position_id FKs (keep legacy columns)
-- ============================================================================
alter table public.profiles
  add column if not exists role_id             uuid references public.roles (id)             on delete set null,
  add column if not exists elected_position_id uuid references public.elected_positions (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 6a. Backfill role_id from the legacy clearance_level for existing rows.
-- ----------------------------------------------------------------------------
update public.profiles p
set role_id = r.id
from public.roles r
where p.role_id is null
  and (
    (p.clearance_level = 'admin'   and r.name = 'SCI / Admin') or
    (p.clearance_level = 'officer' and r.name = 'Executive Officer') or
    (p.clearance_level = 'member'  and r.name = 'General Member')
  );

-- Anything that didn't match a known clearance defaults to General Member.
update public.profiles
set role_id = (select id from public.roles where name = 'General Member' limit 1)
where role_id is null;

-- ============================================================================
-- 7. Update the signup trigger to also assign role_id
-- ============================================================================
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
    clearance_level, role_id
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'full_name',
    nullif(new.raw_user_meta_data ->> 'grade_level', '')::integer,
    new.raw_user_meta_data ->> 'shirt_size',
    new.email,
    case when is_first_user then 'admin' else 'member' end,
    case when is_first_user then admin_role_id else member_role_id end
  );

  return new;
end;
$$;

-- ============================================================================
-- 8. Upgrade RLS helpers — read role permissions, keep clearance_level fallback
-- ============================================================================

-- Admin = role flagged is_admin, OR the legacy clearance_level = 'admin'.
create or replace function public.is_admin()
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
      and (coalesce(r.is_admin, false) or p.clearance_level = 'admin')
  );
$$;

-- Staff = anyone who can run meetings (create_meetings / edit_agendas) or is
-- admin, OR the legacy clearance_level of 'admin'/'officer'.
create or replace function public.is_staff()
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
        or coalesce((r.permissions ->> 'create_meetings')::boolean, false)
        or coalesce((r.permissions ->> 'edit_agendas')::boolean, false)
        or p.clearance_level in ('admin', 'officer')
      )
  );
$$;

-- ============================================================================
-- 9. RLS for the new foundation tables
--    Reads: site_settings / elected_positions / agenda_section_types are needed
--    by the public (anon) site; roles are needed by authenticated permission
--    checks. Writes everywhere are admin-only.
-- ============================================================================
alter table public.roles                enable row level security;
alter table public.elected_positions    enable row level security;
alter table public.agenda_section_types enable row level security;
alter table public.site_settings        enable row level security;

-- roles: any signed-in user reads (for hasPermission); admins manage.
create policy "Authenticated can view roles"
  on public.roles for select to authenticated using (true);
create policy "Admins can manage roles"
  on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- elected_positions: public read (About page); admins manage.
create policy "Anyone can view elected positions"
  on public.elected_positions for select to anon, authenticated using (true);
create policy "Admins can manage elected positions"
  on public.elected_positions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- agenda_section_types: public read; admins manage.
create policy "Anyone can view agenda section types"
  on public.agenda_section_types for select to anon, authenticated using (true);
create policy "Admins can manage agenda section types"
  on public.agenda_section_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings: public read (branding + signup toggle); admins update.
create policy "Anyone can view site settings"
  on public.site_settings for select to anon, authenticated using (true);
create policy "Admins can update site settings"
  on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
