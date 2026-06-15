-- ============================================================================
-- bookkeeping — broaden account deletion to Executive Officers and above.
--
-- Account name/visibility editing continues to ride the existing
-- "Managers can update accounts" policy (manage_bookkeeping). Deleting an
-- account is a more destructive action that the SGA wants reserved for the
-- Executive Officer tier (and anything above it, e.g. SCI / Admin).
--
-- We gate delete on role.order rather than a permission key so the threshold
-- tracks the tier hierarchy even if tier names are customized: any role whose
-- order is >= the "Executive Officer" role's order may delete. Falls back to 4
-- (the default Executive Officer order) if that role has been renamed away.
-- ============================================================================

drop policy if exists "Managers can delete accounts" on public.accounts;

create policy "Executive officers can delete accounts"
  on public.accounts for delete
  to authenticated
  using (
    coalesce(public.current_role_order(), 0)
      >= coalesce(
           (select "order" from public.roles where name = 'Executive Officer'),
           4
         )
  );
