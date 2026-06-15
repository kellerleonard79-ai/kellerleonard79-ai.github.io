-- ============================================================================
-- Footer contact details
--
-- Adds an editable contact email and mailing address to site_settings so the
-- footer can render them and admins can change them from the Admin panel
-- (Public Site → Contact Info). Public read / admin update policies already
-- cover the whole row from the foundation migration (20260607030000).
-- ============================================================================

alter table public.site_settings
  add column if not exists contact_email text
    not null default 'sga@pensacolahigh.edu';

alter table public.site_settings
  add column if not exists contact_address text
    not null default '500 W Maxwell St, Pensacola, FL 32501';
