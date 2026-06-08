-- ============================================================================
-- agenda_items: add section_type_id FK -> agenda_section_types
--
-- Replaces the free-text `section` column with a proper FK to the configurable
-- agenda_section_types table. Following the same transition pattern used for
-- profiles.role_id / clearance_level, the legacy `section` text column is KEPT
-- for now (the agenda editor still groups by it) and the two are dual-written
-- by the app. Once the editor reads exclusively from section_type_id, a later
-- migration can drop `section`.
-- ============================================================================
alter table public.agenda_items
  add column if not exists section_type_id uuid
    references public.agenda_section_types (id) on delete set null;

-- Backfill the FK from the existing free-text section keys.
update public.agenda_items ai
set section_type_id = st.id
from public.agenda_section_types st
where ai.section_type_id is null
  and st.name = case ai.section
    when 'opening'       then 'Opening'
    when 'announcements' then 'Announcements'
    when 'reports'       then 'Reports'
    when 'unfinished'    then 'Unfinished Business'
    when 'new'           then 'New Business'
    when 'open_floor'    then 'Open Floor'
    when 'adjournment'   then 'Adjournment'
    else null
  end;

create index if not exists agenda_items_section_type_idx
  on public.agenda_items (section_type_id);
