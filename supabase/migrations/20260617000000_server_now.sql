-- The frontend needs the database server's current time to detect a skewed
-- device clock. A wrong device clock silently breaks Supabase auth: auth-js
-- compares the JWT's server-issued expiry against the device's Date.now(), so a
-- clock that's off by more than the token lifetime makes every session look
-- permanently expired and all RLS-gated reads return nothing.
--
-- We can't read the HTTP `Date` response header in the browser (Supabase does
-- not CORS-expose it), so we expose server time through a response body via this
-- RPC instead. STABLE + SECURITY DEFINER, granted to anon so it works before
-- login (the public, session-less path that measures skew without touching auth).
create or replace function public.server_now()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now()
$$;

grant execute on function public.server_now() to anon, authenticated;
