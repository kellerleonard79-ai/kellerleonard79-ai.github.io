-- ============================================================================
-- newsletter_emails — public newsletter signup capture
--
-- The footer signup form (visible to anonymous visitors) writes here. Anyone
-- may subscribe (insert); only admins may read/manage the list (for the future
-- "export CSV" admin tool). A unique constraint on email makes re-subscribing a
-- harmless no-op the client treats as success.
-- ============================================================================
create table if not exists public.newsletter_emails (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  created_at timestamptz not null default now()
);

alter table public.newsletter_emails enable row level security;

-- Anyone (including anonymous visitors) can subscribe.
create policy "Anyone can subscribe to the newsletter"
  on public.newsletter_emails for insert
  to anon, authenticated
  with check (true);

-- Only admins can read the collected emails.
create policy "Admins can view newsletter emails"
  on public.newsletter_emails for select
  to authenticated
  using (public.is_admin());

-- Only admins can delete / manage entries.
create policy "Admins can manage newsletter emails"
  on public.newsletter_emails for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
