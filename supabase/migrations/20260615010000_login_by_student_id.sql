-- ============================================================================
-- Login by Student ID
--
-- Supabase Auth only authenticates by email + password, so to let members log
-- in with their student number we need to resolve a student_id -> email before
-- calling signInWithPassword(). This SECURITY DEFINER function exposes ONLY the
-- email for a single matching student_id to anonymous callers — it never opens
-- up the rest of the profiles table.
-- ============================================================================

create or replace function public.email_for_student_id(p_student_id text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.profiles
  where student_id = btrim(p_student_id)
  limit 1;
$$;

-- Allow unauthenticated (anon) and signed-in users to call the lookup.
grant execute on function public.email_for_student_id(text) to anon, authenticated;

comment on function public.email_for_student_id(text) is
  'Resolves a student_id to its account email for login. Returns null if no match.';
