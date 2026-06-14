-- ============================================================================
-- Footer Instagram accounts
--
-- Adds a configurable list of Instagram accounts rendered as the footer's
-- "Follow Our Instagrams" row. Each entry is { "label": ..., "handle": ... };
-- the handle is the Instagram username (without the leading @). Admins manage
-- the list from Admin Settings → General.
--
-- The class-account handles below are placeholders — update them in the Admin
-- Settings panel once the real usernames are known. The SGA handle matches the
-- one already linked elsewhere in the app.
-- ============================================================================

alter table public.site_settings
  add column if not exists instagram_accounts jsonb not null default '[]'::jsonb;

-- Seed the single settings row with the default account row from the design,
-- but only if it hasn't been configured yet.
update public.site_settings
set instagram_accounts = '[
  { "label": "SGA",    "handle": "pensacolahighsga" },
  { "label": "CO2027", "handle": "phs.co2027" },
  { "label": "CO2028", "handle": "phs.co2028" },
  { "label": "CO2029", "handle": "phs.co2029" },
  { "label": "CO2030", "handle": "phs.co2030" }
]'::jsonb
where id = 1
  and (instagram_accounts is null or instagram_accounts = '[]'::jsonb);
