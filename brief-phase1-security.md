# Brief: Phase 1 — Close the Privilege-Escalation Path

Follow-up to `AUDIT.md`. This brief covers **Finding A only**, plus the prod-state check that gates it. Findings B–K are out of scope — don't touch them, don't "while I'm in here" them.

---

## The trap in this task

`AUDIT.md` proposes, as one option for fixing A: *"restore the `app.allow_role_change` check in `prevent_role_change` so the RPC works as intended."*

**Do not do that on autopilot.** It very likely makes things worse.

Today, `confirm_election_winner` is gated on `manage_elections` and then writes a role to the target profile. The drifted trigger currently *reverts* that `role_id` write — which is precisely why the escalation has to launder itself through `clearance_level`. Restoring the flag check would make the `role_id` write succeed. That doesn't close the hole; it promotes it from an awkward side-channel into a clean, first-class, permanent one that will outlive the removal of `clearance_level` entirely. A `manage_elections` holder would then be able to grant the admin tier directly, by design, and the code would look correct.

So the fix depends on a question the audit didn't answer. **Answer it first.**

---

## Step 0 — Prod state (blocking, do this before anything else)

I don't know whether the database in front of you matches the migration files.

- Run `supabase migration list` and report the diff between local migrations and what's applied to prod.
- Specifically: are `20260711000000_assignments_tasks.sql` and `20260712000000_reconcile_position_systems.sql` applied?
- Are there prod objects with no migration behind them, or migrations applied that aren't in the repo?

**Stop and report before proceeding.** If prod has drifted from the migration history, that changes what a new migration can safely assume, and I want to see the drift before we add to it.

---

## Step 1 — Investigate: where does the granted role come from?

Read `confirm_election_winner` (`20260617060000_position_grants_role.sql`) and everything around it, and answer plainly:

1. **Is `p_upgrade_role_id` caller-supplied, or is it derived from the position** (e.g. `elected_positions.grants_role_id`)? The migration name suggests the latter; the signature in the audit suggests the former. Establish which it actually is now, including how the frontend calls it.
2. **If it's derived from the position: what permission gates writing `elected_positions.grants_role_id`?** If that's also `manage_elections` (or anything a `manage_elections` holder can reach), the escalation just moved upstream and the RPC guard alone won't close it.
3. **Is there any constraint today on which role can be granted?** Can it be the `is_admin` tier? A role with `order` above the caller's own?
4. **Who can create the `election_candidates` row** that the RPC consumes? The audit asserts a `manage_elections` holder can create one themselves — verify against the actual RLS on that table.
5. **What else writes `role_id` or `clearance_level`?** Grep every path — RPCs, Edge Functions (`create-user` writes clearance), frontend. I want the full list of doors into those two columns, not just the one the audit found.

Report findings. **Do not write any fix yet.**

---

## Step 2 — The one change that's unambiguously correct

Independent of everything above, this closes the currently-live path and is a prerequisite for any version of the fix:

**Remove the `clearance_level = 'admin'` fallback from `is_admin()`.** Same for the `clearance_level in ('admin','officer')` fallback in `is_staff()` if it can go at the same time without breaking `is_staff` callers — check first, and say so if it can't.

Before doing it, verify from prod that **every profile has a correct, non-null `role_id`** — that fallback is the only thing standing in for a missing role, and I don't want to lock anyone (including me) out. Report the result of that check. If any profile is missing a `role_id`, flag it and stop.

The column, the triggers, and the rest of the `clearance_level` retirement (audit Finding D) stay for now. This is not that refactor.

---

## Step 3 — Propose the durable fix, don't ship it

Based on Step 1, propose how to make `confirm_election_winner` safe. Constraints on the proposal:

- The guard belongs **inside the RPC** (or on the data it reads), not in a trigger. Triggers as the security boundary is what produced this bug — two of them drifted apart across three migrations and nobody noticed.
- Whatever the mechanism, the invariant I want is: **no permission short of `manage_roles` can result in someone holding the admin tier**, and ideally nobody can grant a role at or above their own `order`.
- Reconcile the two guard triggers so they agree with each other and with the RPC. State plainly what each one is now responsible for.
- Prefer the smallest change that establishes the invariant. If the honest answer is "the auto-role-grant feature can't be made safe for non-admin `manage_elections` holders without X," say that — I'd rather narrow the feature than ship a subtle guard.

Give me the proposal as a written plan with the migration SQL sketched out. **Wait for my go-ahead before applying anything.**

---

## Rules of engagement

- No `supabase db push` without explicit approval from me. When we get there, I'll take a dashboard backup first.
- New migration file for any schema change — never edit an existing migration.
- Scope is Finding A + Step 2. Don't fix B, C, D, or the cleanup items. If you spot something new and alarming, write it down and tell me; don't chase it.
- Assume `manage_elections` **will** be delegated to a non-admin officer — it's a checkbox in my own admin panel and I will eventually click it. Treat this as an active hole, not a latent one.

## Done when

- I know whether prod matches the migrations.
- I know exactly which doors lead to `role_id` / `clearance_level`, and who can open each.
- `is_admin()` no longer trusts `clearance_level`.
- I have a proposed fix for the RPC that I've approved, or a clear statement of why the feature needs to be narrowed instead.