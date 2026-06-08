-- ============================================================================
-- bookkeeping — accounts + transactions with tier-gated visibility.
--
-- Visibility mirrors archives exactly: an account is visible only when the
-- viewer's role.order (current_role_order()) is >= the account's
-- visibility_min_role_order. Transactions inherit their account's visibility
-- via a join. Creating accounts, and adding/editing/deleting transactions, is
-- gated on the `manage_bookkeeping` permission (has_permission).
--
-- Running balances are NEVER stored — they are computed client-side from the
-- ordered transaction list (oldest first). Only the raw credit/debit amounts
-- and the account's starting_balance live in the database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- accounts
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id                        uuid        primary key default gen_random_uuid(),
  name                      text        not null,
  description               text        not null default '',
  starting_balance          numeric     not null default 0,
  visibility_min_role_order integer     not null default 0,
  created_by                uuid        references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now()
);

create index if not exists accounts_created_at_idx
  on public.accounts (created_at desc);

alter table public.accounts enable row level security;

-- SELECT: visible only when the viewer's role.order meets the account threshold.
create policy "Members can view permitted accounts"
  on public.accounts for select
  to authenticated
  using (coalesce(public.current_role_order(), 0) >= visibility_min_role_order);

-- INSERT: bookkeeping managers only; they must own the row and may only set a
-- threshold at or below their own tier (cannot hide from tiers above them).
create policy "Managers can create accounts"
  on public.accounts for insert
  to authenticated
  with check (
    public.has_permission('manage_bookkeeping')
    and created_by = auth.uid()
    and visibility_min_role_order <= coalesce(public.current_role_order(), 0)
  );

create policy "Managers can update accounts"
  on public.accounts for update
  to authenticated
  using (public.has_permission('manage_bookkeeping'))
  with check (public.has_permission('manage_bookkeeping'));

create policy "Managers can delete accounts"
  on public.accounts for delete
  to authenticated
  using (public.has_permission('manage_bookkeeping'));

-- ----------------------------------------------------------------------------
-- transactions
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid        primary key default gen_random_uuid(),
  account_id       uuid        not null references public.accounts (id) on delete cascade,
  type             text        not null check (type in ('credit', 'debit')),
  amount           numeric     not null check (amount > 0),
  notes            text        not null default '',
  transaction_date date        not null default current_date,
  created_by       uuid        references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists transactions_account_idx
  on public.transactions (account_id);
create index if not exists transactions_date_idx
  on public.transactions (transaction_date);

alter table public.transactions enable row level security;

-- SELECT: visible when the parent account is visible to the viewer.
create policy "Members can view permitted transactions"
  on public.transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id
        and coalesce(public.current_role_order(), 0) >= a.visibility_min_role_order
    )
  );

-- INSERT/UPDATE/DELETE: bookkeeping managers only.
create policy "Managers can create transactions"
  on public.transactions for insert
  to authenticated
  with check (
    public.has_permission('manage_bookkeeping')
    and created_by = auth.uid()
  );

create policy "Managers can update transactions"
  on public.transactions for update
  to authenticated
  using (public.has_permission('manage_bookkeeping'))
  with check (public.has_permission('manage_bookkeeping'));

create policy "Managers can delete transactions"
  on public.transactions for delete
  to authenticated
  using (public.has_permission('manage_bookkeeping'));
