-- ============================================================================
-- About page support: officer photos + a public, privacy-safe officers view
--
-- The public /about page must show elected officers to anonymous visitors, but
-- `profiles` has no anon SELECT policy (and exposing the whole row would leak
-- email, student_id, dues, etc.). So we expose a narrow view that joins
-- profiles -> elected_positions and surfaces ONLY public-facing columns. The
-- view runs with its owner's privileges (security_invoker = false) so it can
-- read profiles past RLS, and we grant SELECT on just the view to anon.
-- ============================================================================

-- Officer headshot, shown on the About page (placeholder avatar when null).
alter table public.profiles
  add column if not exists photo_url text;

create or replace view public.public_officers
with (security_invoker = false) as
select
  p.id,
  p.full_name,
  p.photo_url,
  ep.title    as position_title,
  ep."group"  as position_group,
  ep."order"  as position_order
from public.profiles p
join public.elected_positions ep on ep.id = p.elected_position_id;

grant select on public.public_officers to anon, authenticated;
