-- Unify the brand maroon to a single shade (#8e231c) across the site.
-- The earlier seed used #7a1620; update the live settings row so runtime
-- branding (which overrides the CSS tokens) reflects the one true maroon.
update public.site_settings
set primary_color = '#8e231c'
where id = 1
  and primary_color in ('#7a1620', '#561016', '#9b2330');
