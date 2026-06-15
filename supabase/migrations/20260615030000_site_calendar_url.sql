-- ============================================================================
-- Homepage Google Calendar embed
--
-- Adds an editable Google Calendar embed URL to site_settings so the homepage
-- "Upcoming Events" calendar can be pointed at a different calendar from the
-- Admin panel (Public Site → Calendar) without a redeploy. Public read / admin
-- update policies already cover the whole row (foundation migration).
-- ============================================================================

alter table public.site_settings
  add column if not exists calendar_url text
    not null default 'https://calendar.google.com/calendar/embed?src=c_0660093bc692b20cf903cc9ebe8c8a7ab767b99fcd4a467cc5b55193b1926b40%40group.calendar.google.com&ctz=America%2FChicago&mode=AGENDA';
