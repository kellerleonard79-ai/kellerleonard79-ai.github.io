-- ============================================================================
-- Homecoming Court candidates — optional 6-digit student number.
--
-- Court candidates are typed in by hand and are not required to have an
-- account, so this is a plain text field on the roster rather than a link to
-- profiles. It exists so the court roster can be reconciled against the school
-- roster; nothing in the app keys off it.
--
-- IMPORTANT — the roster is readable by anon (the /kiosk page loads it while
-- signed out), and a student number is the login identifier for this app
-- (see email_for_student_id). Publishing court candidates' student numbers to
-- anonymous visitors would hand out valid login IDs, so anon's blanket SELECT
-- on this table is replaced with a column-level grant that omits student_id.
-- The kiosk already asks for its columns explicitly, so it is unaffected.
--
-- NOTE (per CLAUDE.md): migrations are NOT auto-applied — apply manually.
-- ============================================================================

alter table public.homecoming_candidates
  add column if not exists student_id text;

-- Optional, but when present it must be exactly six digits — matching how
-- student numbers are issued and how members type them at login.
alter table public.homecoming_candidates
  drop constraint if exists homecoming_candidates_student_id_format;

alter table public.homecoming_candidates
  add constraint homecoming_candidates_student_id_format
    check (student_id is null or student_id ~ '^[0-9]{6}$');

-- Column-level grant: anon may read everything the kiosk needs and nothing
-- else. RLS still applies on top of this (the "Anyone can view homecoming
-- candidates" policy); grants and policies are independent checks.
revoke select on public.homecoming_candidates from anon;

grant select (id, full_name, grade_level, gender, sort_order, created_at)
  on public.homecoming_candidates to anon;

comment on column public.homecoming_candidates.student_id is
  'Optional 6-digit student number, for reconciling the court roster against the school roster. Deliberately not granted to anon — it is also the app''s login identifier.';
