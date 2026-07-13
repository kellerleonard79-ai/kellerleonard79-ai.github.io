# Brief: Full-Stack Audit — PHS SGA Website

## Objective

Conduct a **read-only review** of the entire project — frontend, Supabase database, Edge Functions, and deployment config — and produce a written report of everything that is outdated, redundant, overlapping, fragile, insecure, or poorly built.

The site works and is close to where I want it. This is not a refactor request. **I want the findings first so I can decide what to act on.**

---

## Rules of engagement (important)

- **Do not change anything.** No code edits, no new files (other than the report), no dependency installs/upgrades, no migrations, no `supabase db push`.
- **Read-only DB access only.** `select` queries, `supabase migration list`, schema inspection. No `insert`/`update`/`delete`/`alter`/`drop` against production, not even "harmless" ones.
- If you think something is broken badly enough to warrant an immediate fix, **write it up and ask** — don't fix it inline.
- Where something is ambiguous, say so in the report rather than guessing. "I couldn't determine X without running Y" is a valid finding.

---

## Deliverable

A single markdown file at the repo root: `AUDIT.md`

Structure:

1. **Top findings** — the handful of things you'd fix first, in order, with one line each on why.
2. **Findings by severity**, each grouped section containing individual findings:
   - **Critical** — security holes, data-loss risk, or things silently broken in production
   - **Should fix** — real problems that will bite later (duplication, drift, missing constraints, dead migrations)
   - **Worth cleaning** — dead code, unused deps, inconsistency, minor perf
   - **Noted, no action needed** — things that look wrong but are actually fine, so I don't re-litigate them later
3. **Open questions for me** — anything where the right call depends on intent you can't infer from the code.

For each finding include: what it is, where it lives (file + line, or table/policy name), why it matters, and a **sketch** of the fix (a paragraph, not a diff). Effort estimate: rough T-shirt size is fine.

Be blunt. If something is badly built, say so plainly. Don't pad the report with praise or filler findings to look thorough — a short report with five real problems beats a long one with forty trivia items.

---

## Scope

### Frontend
- Dead code: orphaned components, pages, and utilities left over from the Django-era app, the removed hub-and-spoke dashboard, and the eliminated "Reports" concept.
- Routes that exist but aren't reachable; routes that are reachable but not permission-gated.
- Duplicated logic — multiple components or helpers doing the same job, competing patterns for the same problem (data fetching, modals, forms, tables, loading/error states).
- Dependency health: what's unused, what's outdated, what has known vulnerabilities.
- Anything that should be DB-driven config but is still hardcoded (the `site_settings` / `elected_positions` / `agenda_section_types` / `join_form_schema` pattern is the standard — flag anywhere it wasn't followed).
- Client-side data exposure: anything sensitive fetched to the browser that RLS should be filtering server-side instead.
- Performance: bundle size, unnecessary eager imports, N+1 query patterns against Supabase, refetch loops.

### Supabase / database
- **RLS on every table**, and whether the policies are actually restrictive — call out anything permissive-by-accident (`using (true)`, missing `with check`, policies that any authenticated user satisfies).
- Schema drift: does the migration history reproduce what's actually in production? Are there migrations that were superseded, or prod objects with no migration behind them?
- Tables, columns, enums, and functions that nothing reads anymore.
- Overlapping or redundant models — two places storing the same truth, or two mechanisms enforcing the same rule.
- Foreign keys, `on delete` behavior, `not null`/unique constraints, and indexes on the columns actually being filtered and joined on.
- SQL helper functions: `security definer` correctness, `search_path` pinning, and whether they're used consistently in policies.
- Storage buckets: public vs. private, and whether the object policies match the intent.
- Data hygiene: orphaned rows, users stuck in `pending`, records pointing at deleted parents.

### Edge Functions & deployment
- `delete-user`, `archive-file-url`, `committee-report-url` — is each one still called from anywhere? Is auth verified inside each? Is the service-role key handled correctly? CORS sane?
- GitHub Actions workflows and repo secrets: anything stale or over-scoped.
- Anything in the client bundle that shouldn't be (keys, tokens, internal URLs).

---

## Known suspicions — confirm or refute, then keep looking

These are hypotheses, not a checklist. Don't let them anchor the audit.

1. **Two permission systems are running side by side.** The legacy `clearance_level` text column, `is_admin()`, `is_staff()`, and the `isStaff` value in `AuthContext` still coexist with the intended model (`roles.permissions` jsonb → `hasPermission(key)` / `has_permission(key)`). The migrations explicitly kept the legacy path as a fallback during transition, and `AuthContext` still exposes `isStaff` "for backward compatibility." I want to know: what still depends on the legacy path, is it enforcing anything the new model doesn't, and can it be retired cleanly?
2. **`committee-report-url`** may be a leftover from the Reports concept that was eliminated in the Committees/Assignments refactor.
3. **The `app.allow_role_change` transaction-flag bypass** in the role-guard triggers — is that escape hatch reachable from anywhere it shouldn't be?
4. **Migration count is high relative to project age**, with several functions redefined multiple times across files (`handle_new_user`, `prevent_role_change`, `prevent_clearance_change`). I want to know whether the current definitions are the ones I think they are.

---

## Guardrails on the report itself

- Findings should be **specific and evidenced** — point at the file/line/table, not at a vibe.
- Don't propose a rewrite of anything that works. Prefer the smallest change that removes the risk.
- Don't recommend adding tooling (test frameworks, linters, CI checks, type systems) unless it's directly answering a problem you actually found.
- Severity is about **consequence**, not tidiness. A cosmetic inconsistency is not "Critical" no matter how much it offends.