-- ============================================================================
-- Footer social links
--
-- Adds an editable list of "Follow Us" links (label + href) to site_settings
-- so the footer can render them and admins can manage them from the Admin
-- panel (Public Site → Contact Info). Stored as a jsonb array of
-- { "label": ..., "href": ... } objects. Public read / admin update policies
-- already cover the whole row from the foundation migration.
-- ============================================================================

alter table public.site_settings
  add column if not exists footer_socials jsonb
    not null default '[
      {"label": "Class of ''27", "href": "https://instagram.com/"},
      {"label": "Class of ''28", "href": "https://instagram.com/"},
      {"label": "Class of ''29", "href": "https://instagram.com/"},
      {"label": "Class of ''30", "href": "https://instagram.com/"}
    ]'::jsonb;
