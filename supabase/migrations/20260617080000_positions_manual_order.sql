-- Application positions (public.positions) gain a manual sort order so managers
-- can drag-reorder them in the Elections page. Existing rows are backfilled by
-- their current alphabetical (title) order so nothing jumps on first load.
alter table public.positions
  add column if not exists "order" integer not null default 0;

with ranked as (
  select id, (row_number() over (order by title) - 1) as rn
  from public.positions
)
update public.positions p
set "order" = ranked.rn
from ranked
where ranked.id = p.id;
