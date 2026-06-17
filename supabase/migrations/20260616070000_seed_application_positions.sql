-- ============================================================================
-- Seed the application `positions` table from `elected_positions`.
--
-- The "Apply for an Elected Position" flow (ApplicationDashboard) reads from
-- `positions` (rich: markdown description + a requirements checklist), a table
-- that parallels `elected_positions` but ships empty — so the Choose Position
-- modal always showed "No positions are open". This backfills it from the
-- already-seeded elected positions so the flow works out of the box; managers
-- can then edit/extend them from the Elections page.
--
-- Idempotent: only inserts titles not already present, so re-running (or running
-- after a manager has added their own) never duplicates.
-- ============================================================================
insert into public.positions (title, description, requirements)
select ep.title, null, '{}'::text[]
from public.elected_positions ep
where ep.show_in_elections = true
  and not exists (
    select 1 from public.positions p where p.title = ep.title
  );
