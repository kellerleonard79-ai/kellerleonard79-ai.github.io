# Full-Stack Audit — PHS SGA (Nexus)

Read-only review of frontend, Supabase schema/RLS, Edge Functions, and deploy config. Nothing was changed. Where I couldn't verify something without live DB access, I say so.

**Scope note / limitation:** I audited the migration SQL in `supabase/migrations/` as the source of truth. I did **not** have credentials to connect to the live database, so I could not run `supabase migration list` or diff the migrations against what's actually deployed. Every "is X in prod?" question below is answered from the migration files, not from prod. Flagged where it matters.

---

## 1. Top findings (fix these first)

1. **Role-guard triggers have drifted out of sync with the RPC that depends on them — this is a latent privilege-escalation path.** `prevent_role_change` was redefined a third time and lost the `app.allow_role_change` bypass; `prevent_clearance_change` kept it. Combined with `is_admin()`'s legacy `clearance_level = 'admin'` fallback, a `manage_elections`-only user can promote anyone (including themselves) to full admin. See **Critical A**.
2. **The member directory is silently broken for the default General Member tier.** `view_directory` is granted in the role's permissions but is backed by *no* RLS policy, so non-officer members open the directory and see almost nothing. See **Critical B**.
3. **`view_archives` / `upload_archives` / `view_bookkeeping` are not enforced server-side.** RLS gates those tables on `role.order` and `auth.uid()` only, so the permission keys (and per-member overrides for them) are decorative — any signed-in user, including a pending applicant, can read tier-0 rows and insert `archive_items`. See **Should-fix C**.
4. **Retire the legacy `clearance_level` path.** It's the amplifier that makes finding A reach *admin* rather than just "officer," `isStaff` is already a dead export, and `clearanceForRole` is copy-pasted in five places. See **Should-fix D**.
5. **`committee-report-url` is a ghost.** `config.toml` still declares the function; the function directory is gone and the table it read (`committee_reports`) was dropped. See **Worth-cleaning I**.

---

## 2. Findings by severity

### Critical

#### A. Guard-trigger drift → privilege escalation + silent role-grant failure
**Where:**
- Current `prevent_role_change`: `supabase/migrations/20260617070000_member_permission_overrides.sql:54-71` — checks only `not has_permission('manage_roles')`, **no** `app.allow_role_change` check.
- Current `prevent_clearance_change`: `supabase/migrations/20260608070000_elections.sql:166-180` — checks `not has_permission('manage_roles') AND flag <> 'on'` (flag **still** honored).
- `confirm_election_winner`: `supabase/migrations/20260617060000_position_grants_role.sql:115-122` — sets the flag, then writes both `role_id` and `clearance_level`.
- `is_admin()`: `supabase/migrations/20260607030000_foundation_roles_positions_settings.sql:268-282` — returns true when `r.is_admin OR p.clearance_level = 'admin'`.

**What happens.** `confirm_election_winner` (SECURITY DEFINER, callable by anyone holding `manage_elections`) is designed so a `manage_elections`-only officer can assign a winner's position and upgrade their role. It sets `app.allow_role_change = on` and updates the profile. But the trigger that was supposed to honor that flag for `role_id` was rewritten in a *later* migration (`20260617070000`) and dropped the flag check, while the clearance-level trigger kept it. So on that UPDATE:
- `role_id` change is **reverted** (caller lacks `manage_roles`, flag ignored).
- `clearance_level` change **sticks** (flag honored) → set to `'admin'` when the passed role is the admin tier.
- `is_admin()` then returns true via the `clearance_level = 'admin'` fallback.

**Two consequences, both real:**
- **Escalation (security):** a caller with only `manage_elections` calls `confirm_election_winner(<any candidate>, <admin role id>)`. They can create the candidate row themselves (they hold `manage_elections`). Result: the target's `clearance_level` becomes `'admin'` and `is_admin()` returns true — full admin — even though `role_id` never changed and they never held `manage_roles`. The RPC is `grant execute … to authenticated`, so this is reachable directly at the API, independent of the UI.
- **Correctness (today, even benign):** when a non-admin officer confirms a winner, the intended auto role-grant (Applicant → Class/Exec Officer, the whole point of `20260617060000`) **silently fails** to set `role_id` and leaves the member with a mismatched `clearance_level`. A half-upgraded account.

**Why it isn't already on fire:** by default only the admin tier holds `manage_elections`, and admin callers pass `has_permission('manage_roles')` implicitly, so nothing reverts. The bug only bites the moment `manage_elections` is delegated to a non-admin — which is exactly what the granular permission system exists to allow. It's a booby-trap, not an active breach.

**Fix sketch.** Two things, ideally both: (1) make the two guard triggers consistent — either restore the `app.allow_role_change` check in `prevent_role_change` so the RPC works as intended, or drop it from `prevent_clearance_change` and have `confirm_election_winner` do the role write under a definer path that doesn't depend on the flag at all; (2) remove the `clearance_level = 'admin'` fallback from `is_admin()` (see D) so a stray clearance write can never confer admin. Until (2) lands, the clearance column is a second, weaker door to admin. **Effort: M.**

#### B. `view_directory` is unenforced → directory is empty for General Members
**Where:** `MemberDirectory.jsx` wraps itself in `RequirePermission permission="view_directory"`; the General Member seed grants `view_directory: true` (`20260607030000_…:101-110`). But every `profiles` SELECT policy keys on something *else*: own row (`20260606000000_…:43-46`), `is_admin()` (`:49-52`), `is_staff()` (`20260607000000_meetings_attendance.sql:47-50`), `assign_tasks` and `shares_task_with` (`20260711000000_assignments_tasks.sql:230-238`). **No policy references `view_directory` or `role.order`.**

**What happens.** A General Member (has `view_directory`, is not `is_staff`, has no `assign_tasks`) passes the client gate, opens the directory, and RLS returns only their own row plus anyone they share a task with. The page's core purpose is broken for the tier it's nominally granted to — silently, with no error. Officers don't see it because they satisfy `is_staff()`.

**Fix sketch.** Decide intent (see Open Questions), then align the two layers. If general members *should* see the directory, add a `profiles` SELECT policy `using (has_permission('view_directory'))`. If they *shouldn't*, remove `view_directory` from the General Member seed and drop the client gate to `is_staff`-equivalent. Right now the permission and the RLS disagree. **Effort: S.**

---

### Should fix

#### C. `view_archives` / `upload_archives` / `view_bookkeeping` not enforced in RLS
**Where:**
- `archive_items` SELECT: `20260608060000_archives.sql:68-71` → `coalesce(current_role_order(),0) >= visibility_min_role_order` (default threshold `0`).
- `archive_items` INSERT: `:75-81` → `uploaded_by = auth.uid() AND visibility_min_role_order <= current_role_order` — **no `upload_archives` check**.
- `accounts` SELECT: `20260608080000_bookkeeping.sql:34-37` → same `role.order` gate, **no `view_bookkeeping` check**.
- `Archives.jsx` has **no** `RequirePermission` wrapper (unlike Meetings/Elections/Bookkeeping).

**What happens.** These permission keys are enforced only by hiding buttons/links on the client. Server-side, access is decided by tier order and ownership. So: any authenticated user — including a **pending applicant** (role Applicant, `order = 1`, `view_archives = false`) who navigates directly to `/dashboard/archives` — can read every archive item with `visibility_min_role_order <= 1` (the default is `0`, i.e. most of them) and can `insert` new `archive_items` as themselves. A per-member override that revokes `view_archives`/`view_bookkeeping` from a high-tier member also does nothing to the data. Bookkeeping is tier-gated so it's less exposed, but the same principle: the permission key is not the thing enforcing it.

Blast radius is modest (archive docs are low-sensitivity; inserts consume storage but don't leak) which is why this is Should-fix, not Critical — but it's the clearest instance of "a policy any authenticated user satisfies," and it means the permission model isn't the security boundary it looks like.

**Fix sketch.** Add the permission to the policies: `… for select using (has_permission('view_archives') AND role_order >= threshold)`, `… for insert with check (has_permission('upload_archives') AND …)`, and `accounts … using (has_permission('view_bookkeeping') AND …)`. Add a `RequirePermission permission="view_archives"` wrapper to `Archives.jsx` for the direct-URL case. Confirm intent first (Open Questions) — if tier-order *is* the intended model, then these permission keys should be removed from the tiers UI instead, so they stop implying an enforcement that doesn't exist. **Effort: S–M.**

#### D. Retire the legacy `clearance_level` path
**Where:** column `profiles.clearance_level`; fallbacks in `is_admin()` (`20260607030000_…:280`) and `is_staff()` (`:302`); `isStaff` in `AuthContext.jsx:106`; `prevent_clearance_change` trigger; `clearanceForRole` duplicated in `Profile.jsx:218`, `AdminSettings.jsx:1433`, `Elections.jsx:329`, plus `create-user/index.ts:29` and the SQL `clearance_for_role`.

**What still depends on it:**
- **Enforcement:** only the `OR clearance_level = 'admin'/'officer'` fallbacks in `is_admin()`/`is_staff()`. Since every write path keeps `clearance_level` in sync with `role_id`, the fallback is redundant defense — except that (per finding A) it's also a *second way to become admin*, so it's a net liability, not net safety.
- **Reads:** the frontend reads `clearance_level` only for cosmetic role badges (`DashboardLayout.jsx:241`, `Dashboard.jsx:106`, `RequirePermission.jsx:36`).
- **`isStaff`:** exported from `AuthContext` "for backward compatibility" but **consumed by zero components** (grep-confirmed). Already dead.

**Can it be retired cleanly?** Yes, in this order: (1) verify every profile has a correct `role_id` (needs a prod `select`); (2) drop the `clearance_level` fallbacks from `is_admin()`/`is_staff()`; (3) replace the cosmetic reads with `profile.role.name`; (4) delete `isStaff`, the five `clearanceForRole` copies, and the `clearance_level` writes in `Profile`/`AdminSettings`/`Elections`/`create-user`; (5) drop `prevent_clearance_change` and finally the column. Do (2) as part of fixing A regardless. **Effort: M.**

#### E. `is_staff()` and `using(true)` reads are coarser than the permission model implies
**Where:** `is_staff()` = `create_meetings OR edit_agendas OR admin OR legacy` (`20260607030000_…:293-304`), used for **all** management of `meetings`, `agenda_items`, and `attendance`. Separately, still-live `using(true)` authenticated SELECT policies on `meetings` (`20260607000000_…:62`), `agenda_items` (`20260607010000_…:46`), `committees` (anon, `20260608090000_…:42`), and `committee_members` (`:75`).

**What it means.** (a) The plan separates `create_meetings` from `edit_agendas`, but `is_staff()` collapses them — anyone with *either* can create/delete meetings and edit any agenda. (b) The `using(true)` reads let any authenticated user (including pending applicants) pull meeting lists, agenda items, and committee rosters straight from the API regardless of `view_meetings`. This is display data, so it's low-severity, but it's the same client-only-gating pattern as C. Note `committees` is intentionally `anon` (About page) — that one's fine.

**Fix sketch.** If the granularity matters, split the meetings/agenda policies onto `has_permission('create_meetings')` vs `has_permission('edit_agendas')` and gate the SELECTs on `view_meetings`. If it doesn't, leave it — but then `is_staff` and the two separate permission keys are more precise on paper than in practice. **Effort: S.** (Reasonable to leave as-is; flagging so it's a decision, not an accident.)

#### F. `email_for_student_id` is an email-enumeration oracle
**Where:** `20260615010000_login_by_student_id.sql`, `grant execute … to anon`.

**What it means.** Login-by-student-ID requires resolving student_id → email before `signInWithPassword`. This RPC does exactly that for anonymous callers. Student IDs are short and guessable/sequential, so an anonymous script can walk the ID space and harvest the email for every account. It exposes *only* the email (not the rest of the row), so it's contained, but it is a PII-enumeration surface that didn't exist before login-by-ID.

**Fix sketch.** Accept it as an inherent cost of the login model, or blunt it: add a captcha/rate-limit in front of the login flow, or move the lookup behind the sign-in Edge path so it isn't a standalone anon RPC. **Effort: S** (mitigation) — but partly a product decision.

#### G. Migrations are hand-applied while the frontend auto-deploys — ordering hazard
**Where:** `.github/workflows/deploy.yml` (auto-deploys `main` → Pages on every push); `CLAUDE.md` and every migration header note migrations are applied by hand. Two large, recent, order-sensitive migrations sit on this branch: `20260711000000_assignments_tasks.sql` (drops `committee_tasks`/`committee_reports`, adds `tasks`/`task_assignees`/`task_submissions`) and `20260712000000_reconcile_position_systems.sql` (drops `positions`, repoints FKs).

**What it means.** Merging `feat/dedicated-assignments-page` to `main` will deploy a frontend that queries `tasks`/`task_assignees` (`Assignments.jsx`, `Committees.jsx`, `Dashboard.jsx`) the instant the build finishes — but the tables only exist if someone has *already* run both migrations, in order, against prod by hand. If the human step is skipped or mis-ordered, the app is broken in production with RLS/relation errors and nothing gates that. I can't tell from here whether these two are applied to prod yet.

**Fix sketch.** No new tooling needed — just a rule: apply the migration(s) to prod *before* merging the frontend that needs them, and confirm with a `supabase migration list` diff. If this bites often, gate the Pages deploy on a manual approval. **Effort: S** (process).

---

### Worth cleaning

#### H. `RequireAuth.jsx` is dead
No file imports it (grep-confirmed; only `DashboardLayout` mentions it in a comment). The shell replaced it. Delete the file. **Effort: XS.**

#### I. `committee-report-url` ghost + orphaned buckets
`supabase/config.toml` still has a `[functions.committee-report-url]` block, but there is no `supabase/functions/committee-report-url/` directory and the `committee_reports` table it read was dropped (`20260711…:307`). `deploy-functions.yml` iterates `supabase/functions/*/`, so it never re-deploys or removes it — if it was ever deployed, it's still live in prod and would now error against a missing table. Nothing calls it (grep-confirmed). Also orphaned: the `committee-reports` and (post-migration) `committee-task-files` storage **buckets** — the migration drops their policies but notes buckets can't be dropped from SQL, so they linger until deleted from the dashboard. **Fix:** remove the config block; delete the deployed function and the two unused buckets from the Supabase dashboard. **Effort: XS.**

#### J. `site_settings.accent_color` is dead config
`SiteSettingsContext.jsx:24` deliberately maps `--color-accent` to `primary_color` (the "maroon + white only" decision), so the `accent_color` column and any Admin control for it do nothing. `bg_color` *is* applied. Either drop the column + control, or leave a comment; right now it silently no-ops. **Effort: XS.**

#### K. `clearanceForRole` duplicated five times
Same function in `Profile.jsx:218`, `AdminSettings.jsx:1433`, `Elections.jsx:329`, `create-user/index.ts:29`, and SQL `clearance_for_role`. Collapses to one shared helper (or disappears entirely) when D lands. **Effort: XS** (folds into D).

---

### Noted — looks wrong, is actually fine (don't re-litigate)

- **Edge Functions are consistently correct.** All six (`create-user`, `delete-user`, `archive-file-url`, `agenda-file-url`, `task-file-url`, `upload-document`) follow verify-then-act: a caller-scoped client checks `is_admin()`/`has_permission()`/RLS against the user's own JWT, then the service-role client acts. `Access-Control-Allow-Origin: *` is fine here — these are Bearer-token APIs, not cookie auth, so there's no CSRF surface. Signed URLs are 60s. No notes.
- **RLS is enabled on all 28 tables.** Verified table-by-table.
- **No secrets in the repo or bundle.** Only `VITE_SUPABASE_ANON_KEY` ships to the client (correct — it's public and RLS-bound). `scripts/seed-test-users.mjs` uses an admin JWT via `create-user`, not a service-role key. No service-role key anywhere in `src/`.
- **`handle_new_user` is the complete, current definition.** Despite being redefined ~7 times, the winner by timestamp (`20260616040000_candidate_position_selection.sql`) is cumulative and includes everything (role_id, status, `is_candidate_application`, `custom_fields`, candidate seeding). No stale partial definition is winning. (This refutes part of suspicion #4 — but see A for `prevent_role_change`, where a stale-vs-current mismatch *does* bite.)
- **`app.allow_role_change` is not directly reachable.** It's set transaction-locally (`set_config(…, true)`) only inside `confirm_election_winner`, and `set_config` lives in `pg_catalog`, which PostgREST doesn't expose as an RPC. The risk is not "a user sets the flag" — it's the trigger drift in A.
- **Public reads use `supabasePublic` correctly** (Home, About, ElectionsPublic, Footer, SiteSettings), and `get_public_candidates`/`public_committees` intentionally expose candidate/officer *names* to anon for the public roster/About page. By design.
- **Clock-skew compensation** (`clockCheck.js` + `supabaseClient.js` storage wrapper) looks deliberate and load-bearing; not touched.
- **`dist/` is git-ignored** and only present as a local build artifact.

---

## 3. Open questions for me

1. **Directory intent (finding B):** should General Members see the full member directory, or only officers? The permission says yes, the RLS says no — I need the intended answer to know which side to change.
2. **Archives/bookkeeping intent (finding C):** is access meant to be gated by the `view_archives`/`view_bookkeeping` *permission keys*, or purely by tier order (`role.order`)? If it's tier order, those permission checkboxes in the Tiers UI are misleading and should go; if it's the keys, RLS needs them added.
3. **Is `manage_elections` ever going to be delegated to a non-admin?** That single fact decides whether finding A is a latent trap (fix when convenient) or an active hole (fix now).
4. **Any real `committee_reports` rows to export** before deleting the orphaned bucket, or was that all test data (as the migration assumed)?
5. **Have `20260711` and `20260712` been applied to prod yet?** I couldn't check. If not, don't merge this branch to `main` until they are (finding G).
