# Nexus 2.0 — Full Project Plan
> Reference document for Claude Code sessions. Covers architecture, data models, feature specs, access control, and a staged build order.

> **Reconciled 2026-09-06.** This was the pre-build vision doc; the repo has since implemented most of it and diverged in a few places. The repo's own `CLAUDE.md` documents what's actually built and is the source of truth for current behavior — treat this file as the original plan with corrections/status notes layered in, not as ground truth on its own. Headline deltas:
> - **Routing is NOT hash-based.** The app uses `BrowserRouter` with real paths; the `404.html` copy trick (still accurate) handles GitHub Pages deep links instead.
> - **Login is by student ID, not email.** `Login` resolves student ID → email via an `email_for_student_id()` RPC, then signs in normally.
> - **Branding is fixed to maroon (#8e231c) + white**, not admin-customizable despite the schema columns below still existing. There is no live "Branding" tab in Admin Settings.
> - **Committees vs. work assignments were unified.** `committee_reports` and the position-application flow described in earlier stages were superseded by a single `tasks` / `task_assignees` / `task_submissions` system (see §3 and §5B).
> - **Elections gained a second, richer flow** — position applications with requirements/checklists, interview scheduling with bookable slots, and per-member position-change limits — layered on top of the original cycles/candidates tables (see §3).
> - Stages 1–8 below are substantially built; see the per-stage status notes in §6.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | **React 19** (with React Router DOM v7; actual: `BrowserRouter` + real paths, not hash routing — see reconciliation note above) |
| Build tool | **Vite 6** |
| CSS | **Tailwind CSS v4** (via `@tailwindcss/vite` plugin) |
| Icons | **lucide-react** |
| QR codes | **qrcode.react** |
| Backend / DB | **Supabase** (Postgres + Auth + Storage) |
| Supabase client | `@supabase/supabase-js` v2 |
| Auth | Supabase Auth (email+password under the hood; **user-facing login is by student ID** via `email_for_student_id()` RPC → `signInWithPassword`) |
| File storage | Supabase Storage (uploads) + Drive link embeds (Archives) |
| Hosting | **GitHub Pages** — repo `kellerleonard79-ai.github.io`, one site, public + officer tools |
| Deploy | GitHub Actions workflow (`.github/workflows/`) — `vite build` → `dist/`, `index.html` copied to `404.html` for SPA routing |
| Supabase migrations | `/supabase/` folder in repo |
| Data migration | Manual / one-time for small existing dataset — no migration script needed |

**Key notes for Claude Code:**
- Routing uses real paths (`/dashboard`, `/login`, etc.) via `BrowserRouter`, NOT hash routing — GitHub Pages' lack of server-side redirects is instead handled by copying `dist/index.html` to `dist/404.html` as part of the build (`npm run build`)
- Tailwind v4 uses the Vite plugin approach, NOT `tailwind.config.js` — config is done in CSS with `@theme` directives
- `supabase/migrations/` has 45+ migration files already deployed — always check existing migrations before adding tables/columns. **Migrations are not auto-applied**; new files must be applied to the hosted DB by hand (Supabase CLI/dashboard)
- `qrcode.react`, `jspdf`, and `html2canvas` are already installed (QR generation and client-side PDF export) — no need to add them
- All `/dashboard/*` routes nest under one layout route (`src/components/DashboardLayout.jsx`) with a persistent sidebar; dashboard pages don't render their own `Navbar`/`Footer`/`RequireAuth`
- `src/lib/permissions.js` / `AuthContext.hasPermission(key)` is the canonical permission check everywhere — never compare roles/tiers inline

---

## 2. Permission Tiers

Tiers are **fully customizable by Admin** — names, count, and per-feature permissions are all configurable from the Admin Settings panel. The defaults below are the starting point.

Default five tiers. Each tier stored as a row in the `roles` table (not a hardcoded enum). The `profiles` table stores a `role_id` FK rather than a raw string.

| Tier | Default Label | Notes |
|---|---|---|
| 1 | Applicant | Just submitted Join SGA; pending approval. Cannot access dashboard or directory. |
| 2 | General Member | Approved member. Can access dashboard with limited tools. |
| 3 | Class Officer | Grade-level elected officer. |
| 4 | Executive Officer | School-wide elected officer. |
| 5 | SCI / Admin | Full access. Can modify all profiles, settings, and locked features. |

**Key rule:** "Security Clearance" is just the label for this tier system — it's not a separate feature, it's how roles are managed. Admin can rename tiers, add new tiers, or reorder them. Permissions per tier are configured via a fixed set of permission checkboxes (see Admin Settings below).

---

## 3. Supabase Schema (tables)

### `roles` *(new — replaces hardcoded role enum)*
```
id (uuid)
name (text, unique) — e.g. "General Member", "Class Officer"
order (int) — higher = more access
permissions (jsonb) — map of permission keys to booleans
  e.g. { "view_directory": true, "edit_agendas": true, "manage_bookkeeping": false, ... }
is_admin (bool) — marks the top-level admin tier; only one row can have this true
created_at (timestamp)
```

**Permission keys (fixed set, Admin checks on/off per role):**
`view_directory`, `edit_directory`, `view_meetings`, `create_meetings`, `edit_agendas`,
`view_bookkeeping`, `manage_bookkeeping`, `view_archives`, `upload_archives`,
`view_elections`, `manage_elections`, `edit_site`, `manage_roles`, `manage_committees`,
`assign_tasks` *(added post-launch — gates the Assignments/tasks system, §3/§5B)*

**Built:** `src/lib/permissions.js` exports this exact list as `PERMISSION_KEYS`. Admin roles (`is_admin`) pass every check unconditionally. As of `20260617070000_member_permission_overrides`, `profiles.permission_overrides` (jsonb) lets an admin grant/revoke individual keys **per member**, on top of their role default — resolution order is override → role → false (mirrored in SQL `has_permission()` and JS `effectivePermission()`).

### `elected_positions` *(new — replaces hardcoded position enum)*
```
id (uuid)
title (text, unique) — e.g. "Executive President", "Junior Secretary"
group (text) — exec | senior | junior | sophomore | freshman | custom
order (int) — display order within group
show_in_elections (bool) — whether this position appears as an option in election candidacy
default_role_id (uuid, FK → roles, nullable) — role auto-granted when a candidate wins this position (upgrade-only; admin-editable, added 20260617060000)
description (text, nullable) — Markdown blurb shown on the application flow (added 20260712000000)
requirements (text[]) — checklist an applicant must acknowledge (added 20260712000000)
created_at (timestamp)
```

### `profiles` — **actual built schema differs from this plan's naming**
Extends Supabase Auth users (`id` FK → `auth.users`).
```
id (uuid, FK → auth.users)
student_id (text, unique)
full_name (text)
email (text)
grade_level (integer)                     -- plan called this "grade"
shirt_size (text)
clearance_level (text, default 'member')  -- LEGACY: member|officer|admin, still synced for
                                           -- back-compat (e.g. create-user function) but no
                                           -- longer trusted for authorization (20260713000000
                                           -- dropped its is_admin()/is_staff() fallback).
                                           -- roles/role_id is the source of truth.
role_id (uuid, FK → roles)
elected_position_id (uuid, FK → elected_positions, nullable)
position (text)                            -- legacy free-text mirror, predates elected_position_id
dues_paid (bool, default false)            -- plan called this "dues_status"
status (text, default 'active')            -- pending | active | ... — signups land 'pending'
                                            -- until an admin approves (20260608020000); the
                                            -- very first user bootstraps as 'active' admin
academy (text)                             -- "SCI" badge shown on profile/directory
is_candidate_application (bool, default false) -- set at signup if applying for a position
permission_overrides (jsonb, default {})   -- per-member permission grant/revoke on top of role
photo_url (text, nullable)
custom_fields (jsonb, nullable) — stores values for any custom Join SGA fields
created_at (timestamp)
```

### `committees`
```
id, name, description, created_at
```

### `committee_members`
```
id, committee_id (FK), member_id (FK), is_chair (bool), joined_at
```

### ~~`committee_reports`~~ — **superseded, table dropped**
Built initially per this plan, then replaced by `committee_tasks`/`committee_task_submissions`, then generalized further into the `tasks` system below (migration `20260711000000_assignments_tasks` drops both `committee_reports` and `committee_tasks`). "Assigning a report" is now just assigning a task — a submission already carries body text and an optional file.

### `tasks` *(current — the one work-assignment system, replaces `committee_reports`)*
```
id, title, description, due_date (date, nullable),
requires_each (bool) — true = every assignee must submit; false = any one submission completes it
committee_id (FK → committees, nullable) — DISPLAY/grouping context only, never the assignment
                                            mechanism; deleting a committee keeps its tasks (set null)
created_by (FK), created_at
```

### `task_assignees`
```
task_id (FK), member_id (FK) — the resolved assignee SET, snapshotted at creation time.
```
Committee/grade pickers in the UI are just shortcuts that populate this set — joining a committee later does **not** retroactively assign its open tasks.

### `task_submissions`
```
id, task_id (FK), member_id (FK → profiles), body (text, nullable), file_url (text, nullable — raw
storage path, never sent to clients), has_file (generated bool, = file_url is not null), created_at
CHECK (body is not null or file_url is not null)
```
Files live in the private `committee-task-files` bucket, opened via the `task-file-url` Edge Function (service-role signed URL after re-verifying the caller).

### `announcements`
```
id, title, body, is_published (bool), created_by (FK), created_at, updated_at
```

### `site_settings`
Single-row table. Built with more columns than originally planned:
```
id (always 1), signup_enabled (bool), about_purpose_text (text),
quorum_type (text) — half_active | half_officers | custom,
quorum_custom_value (int, nullable),
school_name, tagline, logo_url, primary_color, accent_color, bg_color   -- present in schema
  but NOT wired to an admin UI — branding is hardcoded to maroon+white, see reconciliation note
join_form_schema (jsonb) — drives the dynamic /join form, actually built as planned
contact_email, contact_address (text) — added 20260615020000, shown in footer/About
calendar_url (text) — added 20260615040000, the embedded Google Calendar iframe src
footer_socials (jsonb) — added 20260616010000, admin-editable social links list
constitution_url (text) — added 20260616030000, link to the SGA constitution document
campaign_rules_md (text), endorsement_form_url (text) — added 20260616060000, elections v2 copy
candidate_position_change_limit (int, default 3) — added 20260616040000
```

### `newsletter_emails`
```
id, email, created_at
```

### `meetings` — **flatter than planned: no separate `attendance_sessions` or `agendas` tables**
QR/attendance session state AND the agenda's opening/adjournment fields live directly on `meetings`, not in child tables. `/checkin/:meetingId` uses the meeting's own id — there's no separate `qr_token`.
```
id, date, title, agenda (text, legacy — superseded by agenda_items below), is_active (bool) — manual QR
  session toggle, session_start/session_end (timestamptz, nullable) — added 20260616080000, lets
  officers pre-schedule the check-in window instead of toggling it live (check-in opens when EITHER
  is_active is true OR now() falls inside this window),
presiding_officer (text), called_to_order (timestamptz, nullable), quorum_confirmed (bool),
agenda_approved (bool), next_meeting_date (date, nullable), adjourned_at (timestamptz, nullable),
created_at
```

### `attendance` — plan called this `attendance_records`; there is no `attendance_sessions` table
```
id, meeting_id (FK), profile_id (FK) — plan called this "member_id",
status (text, default 'present') — present | excused | unexcused,
source (text, default 'qr') — qr | manual,
checked_in_at (timestamp)
UNIQUE (meeting_id, profile_id)
```

### `agenda_items` — plan's `agendas`/`agenda_sections`/`agenda_subitems` were never built as separate tables
One flat, self-referential table per meeting instead of the planned 4-table hierarchy:
```
id, meeting_id (FK), parent_id (FK self, nullable) — plan's separate "subitems" concept,
section (text) — FK'd to `agenda_section_types.id` as of 20260608010000, was a free-text enum before
  (opening | announcements | reports | unfinished | new | open_floor | adjournment),
content (text) — plan called this "text", status (text, free-form: "Approved"/"Tabled"/etc — plan
  had a closed enum; built as open text), secretary_notes (text), position (int) — plan called this
  "order", created_at
```
`carried_from_id` (plan's "carry tabled items forward" concept) was **not** built as a column — check `AgendaEditor.jsx` before assuming it exists; the file also carries `agenda_item_attachments` (added `20260616000000`) for per-item file uploads, which the plan didn't anticipate.

### `election_cycles`
```
id, name (e.g. "Spring 2026"), is_open (bool) — plan called this "applications_open",
open_date (timestamp, nullable), close_date (timestamp, nullable),
filing_deadline (timestamp, nullable) — added 20260616040000; after this, no new candidate
                                         applications or position changes for the cycle
interview_weight (float, default 0.5), election_weight (float, default 0.5)
  CHECK (interview_weight + election_weight ≈ 1.0)
created_by (FK), created_at
```

### `election_candidates`
```
id, cycle_id (FK, nullable) — null = mid-year fill,
member_id (FK), position_id (FK → elected_positions) — plan had this as free-text "position",
status (text) — pending | interviewing | approved | rejected | winner | assigned,
interview_score (float 0–100, nullable), interview_notes (text),
vote_count (int, nullable), vote_percentage (float, nullable),
composite_score (float, nullable — computed and written by the app, NOT a generated column),
position_changes_used (int, default 0) — added 20260616040000, enforced against
                                          site_settings.candidate_position_change_limit
created_at
```
Winner confirmation/revocation run through `confirm_election_winner()` / revoke RPCs (SECURITY DEFINER) so a `manage_elections`-only admin can assign `profiles.elected_position_id` and auto-upgrade the winner's role via `elected_positions.default_role_id` (upgrade-only — never downgrades) without also needing `manage_roles`.

### Elections v2 — position applications + interview scheduling *(built, not in original plan)*
A parallel, richer application flow layered on top of the cycles/candidates tables above (bridged, not merged, by migration `20260712000000_reconcile_position_systems`):
```
applicants
  id, member_id (FK), student_id, position_id (FK → elected_positions),
  fallback_to_general (bool), signature_doc_url (text, nullable),
  rules_acknowledged (bool), status (text) — provisional | fully_qualified (derived by trigger,
  never client-set), election_candidate_id (FK → election_candidates) — kept in sync so a
  completed application always has a matching scored-candidate row, created_at, updated_at
  UNIQUE (member_id, position_id)

interview_sessions   — admin-defined time block (e.g. 7:30–8:20 AM), auto-sliced into slots
interview_slots      — individual bookable intervals applicants reserve into
```
`elected_positions` absorbed this flow's `description` (Markdown blurb) + `requirements` (checklist) columns; the original standalone `positions` table was dropped once repointed. Endorsement uploads go to a private `applications` storage bucket (per-applicant folder); `site_settings.campaign_rules_md` and `endorsement_form_url` hold the admin-editable rules copy and endorsement-form template link. All writes go through SECURITY DEFINER RPCs / RLS keyed on `has_permission('manage_elections')`.

### `accounts` (Bookkeeping)
```
id, name, description, starting_balance (numeric), created_by (FK),
visible_to (text) — role threshold set by Admin, created_at
```

### `transactions`
```
id, account_id (FK), type (text) — credit | debit, amount (numeric),
notes (text), transaction_date (date), created_by (FK), created_at
```

### `archive_items`
```
id, title, description, category (text), tags (text[]),
folder_path (text) — e.g. "2025/Minutes",
file_url (text, nullable), drive_link (text, nullable),
visibility_min_role (text) — minimum role required to see it,
uploaded_by (FK), created_at
```

---

## 4. Access Control Matrix

Still broadly accurate as the *default* shape, but remember tiers/permissions are fully data-driven — an admin can reconfigure any cell per role, and `profiles.permission_overrides` can further override any single member regardless of tier (§2/§3).

| Feature | Applicant | General Member | Class Officer | Exec Officer | SCI/Admin |
|---|---|---|---|---|---|
| Public site | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| Member Directory | ❌ | ✅ | ✅ | ✅ | ✅ |
| Own Profile | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit any profile | ❌ | ❌ | ❌ | ❌ | ✅ |
| Meetings | ❌ | ✅ (view) | ✅ | ✅ | ✅ |
| Agenda Editor | ❌ | ❌ | ✅ | ✅ | ✅ |
| Archives (upload) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Site | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bookkeeping | ❌ | ❌ | per account | per account | ✅ |
| Elections Mgmt | ❌ | ❌ | ❌ | ❌ | ✅ |
| Security Clearance | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. Page & Feature Inventory

> **This whole section describes intended routes/paths from before the build.** The actual route table (`src/App.jsx`) differs in real ways — see corrected paths and behavior below. Where a page's internals weren't independently re-audited for this reconciliation, treat the plan's bullet list as roughly right but verify in the source file before relying on specifics.

### 5A. Public Site (no login required)

#### `/` — Homepage
- Hero + announcements feed + newsletter signup as planned
- **Google Calendar embed src is admin-editable** (`site_settings.calendar_url`), not hardcoded
- **Footer social links are admin-editable** (`site_settings.footer_socials`, jsonb list), not a fixed Instagram embed — confirm current Instagram-embed status in `Home.jsx`/`Footer.jsx` before assuming it's still there
- "Join SGA" button gated on `signup_enabled` as planned

#### `/about` — About
- As planned: purpose text, exec/class officer sections from `elected_positions` groups, committees section

#### `/join` — Join SGA
- Dynamic form driven by `join_form_schema` as planned (built as designed, incl. drag-reorder custom fields)
- New signups land `status = 'pending'`, not auto-active — an admin must approve via Admin Settings → Members before the account can use the dashboard (`20260608020000_pending_signup_and_profile_admin`); the very first user ever created bootstraps straight to `active`/admin
- "Running for a position" sets `profiles.is_candidate_application`, not a `role` value — the plan's `role = applicant` framing doesn't match; role assignment is via `role_id`

#### `/elections` — Public Elections *(`ElectionsPublic.jsx`, not in original plan)*
- Public, privacy-safe candidate roster (names/positions/qualification status only) fed by `get_public_candidates()`

#### No standalone public agenda page, and no anonymous QR check-in
The plan's `/agenda/:meeting_id/public` and token-based anonymous `/checkin/:token` were **not built as designed**:
- **`/checkin/:meetingId`** (`Checkin.jsx`) requires the visitor to be logged in — an unauthenticated scan redirects to `/login?redirect=/checkin/:meetingId` and back. There's no anonymous student-ID-entry flow; check-in always writes the *authenticated* caller's own `profiles.id`.
- Agenda viewing lives only inside the dashboard (`/dashboard/meetings/:id/agenda`, auth required) — there is no read-only public agenda route.

---

### 5B. Officer Dashboard (login required — gated by `DashboardLayout`, not per-page `RequireAuth`)

All `/dashboard/*` routes below render inside one persistent sidebar shell; the sidebar itself hides tools the signed-in member lacks permission for, and pages that need a specific permission additionally wrap their content in `RequirePermission`/`RequireStaff` for direct-URL protection.

#### `/dashboard` — Dashboard Home (`Dashboard.jsx`)
- **Not the card-grid hub the plan describes.** It's now a light welcome pane; the permission-gated tool grid lives in the sidebar instead.

#### `/dashboard/members` — Member Directory (plan called this `/dashboard/directory`)
- Roughly as planned (`MemberDirectory.jsx`) — verify current filter set in source before relying on specifics; the plan's `dues_status` field is actually `dues_paid` (bool)

#### `/dashboard/profile` — Own profile; `/dashboard/members/:id` — Member profile, SCI edit
Both routes render the same `Profile.jsx` component (plan had these as two separate pages/paths, and used a `:student_id` param — actual param is `:id`).

#### `/dashboard/edit-site` and `/dashboard/security` — **legacy redirects, pages no longer exist standalone**
Both `<Navigate>` into the unified `/dashboard/admin/:section` (Edit Site → `admin/announcements`, Security Clearance → `admin/members`). See §8 for the real tab list.

#### `/dashboard/admin`, `/dashboard/admin/:section` — Admin Settings (`AdminSettings.jsx`, unified hub)
Replaces the plan's separate Edit Site + Security Clearance pages; see §8 for the actual tabs (they don't match the plan's Tab 1–6 breakdown).

#### `/dashboard/bookkeeping` (`Bookkeeping.jsx`)
- Roughly as planned — verify CSV export and `visible_to` gating specifics in source before relying on them

#### `/dashboard/elections` (`Elections.jsx`, ~1500 lines)
- Cycles, candidates, scoring, winner confirmation as planned, **plus** the elections-v2 layer not in the original plan: position applications with requirements checklists, interview session/slot scheduling, endorsement uploads, per-cycle filing deadlines, and position-change-limit enforcement (§3)

#### `/dashboard/application` — Application Dashboard (`ApplicationDashboard.jsx`, not in original plan)
- The self-service "My Application" checklist for a member applying for an elected position: position pick/change (up to the configured limit, before the filing deadline), rules acknowledgment, endorsement upload, interview slot booking. The old `/dashboard/candidacy` deep link redirects here.

#### `/dashboard/archives` (`Archives.jsx`)
- Roughly as planned — verify visibility-restriction direction (down-only from uploader's tier) in source before relying on it

#### `/dashboard/committees` (`Committees.jsx`) — **narrower than planned: no report submission here**
Committees is now purely the org chart (roster/chair/description, `manage_committees`-gated Manage mode). The plan's "Committee report submission (text or file upload)" is **not here** — it moved into the unified work-assignment system below.

#### `/dashboard/assignments` — Assignments (`Assignments.jsx`, replaces "Committee Reports", not in original plan)
- The single work-assignment system for the whole app, gated by the `assign_tasks` permission: an assignment = a `tasks` row + an explicit assignee snapshot (`task_assignees`); committee/grade pickers are just shortcuts that populate that snapshot at creation time (joining a committee later does **not** retroactively pick up its open tasks). `task_submissions` is the only submission mechanism app-wide (`requires_each` on the task controls whether every assignee or just one must submit). The old `/dashboard/admin/committee-tasks` deep link redirects here.

#### `/dashboard/meetings`, `/dashboard/meetings/:id` (`Meetings.jsx`, `MeetingDetail.jsx`)
- Roughly as planned; there's no separate `/dashboard/meetings/new` route — creation happens inline from the list

#### `/dashboard/meetings/:id/agenda` — Agenda Editor (`AgendaEditor.jsx`, ~1560 lines)
- Sections/items, drag-reorder, status + secretary notes, PDF export (`jspdf`+`html2canvas`) as planned
- **No "carry tabled items to next meeting" feature** was found in the schema or a quick source check — verify in `AgendaEditor.jsx` before assuming this exists
- **No public read-only agenda view** to link out to (see 5A) — the "Public view" / QR-scan-to-agenda flow described in the plan isn't there
- Per-item file/link attachments (`agenda_item_attachments`, incl. Archives cross-references) were added — not in the original plan

#### `/dashboard/meetings/:id/session` — QR Session View (`SessionView.jsx`, plan called this `/dashboard/attendance/:token`)
- Live check-ins, quorum indicator, QR display, manual attendance (Present/Excused/Unexcused) roughly as planned — there's no separate session token; the meeting's own id is the check-in key, and open/close is `is_active` plus the optional `session_start`/`session_end` window

---

## 6. Build Stages — status (this section is now history, not a to-do list)

The stages below were the planned order. **Stages 1–8 are built** (with the structural deltas cataloged in §3/§5 — schema shapes, route paths, and a few descoped/replaced features differ from what's written here). Treat this section as a record of what was intended, not as remaining work; check §9's updated stage list for what Admin Settings actually shipped as, and the repo's own `CLAUDE.md` for anything newer than this reconciliation pass.

### Stage 1 — Foundation ✅ built
- Supabase tables, RLS basics, auth (student-ID login, not email — see reconciliation note), `hasPermission` route guarding, base layout
- Design tokens landed as **maroon + white only**, not "maroon/white/gray/gold"

### Stage 2 — Public Site ✅ built, with deltas
- Homepage/About/Join built; **no public agenda view or anonymous QR check-in** (§5A) — check-in requires login

### Stage 3 — Dashboard Shell + Directory ✅ built, restructured
- Card-grid hub became a persistent sidebar shell (`DashboardLayout.jsx`); directory/profile pages built

### Stage 4 — Meetings & Agenda ✅ built, with deltas
- No separate `agendas`/`attendance_sessions` tables (flattened onto `meetings`/`agenda_items`/`attendance`, §3); PDF export built (`jspdf`+`html2canvas`); no carry-tabled-items feature found

### Stage 5 — Officer Tools ✅ built, restructured
- Folded into the unified `/dashboard/admin/:section` hub rather than separate Edit Site / Security Clearance pages

### Stage 6 — Elections ✅ built, and extended
- Original cycles/candidates flow built, **plus** a whole second layer (position applications, interview scheduling, endorsements) not in this plan — see §3/§5B

### Stage 7 — Bookkeeping ✅ built
- Verify CSV export and per-account visibility specifics in `Bookkeeping.jsx` before relying on them; not independently re-audited for this reconciliation

### Stage 8 — Committees ✅ built, redesigned
- Committees narrowed to pure org-chart; report/task submission generalized into the cross-cutting `tasks`/Assignments system (§3/§5B), not committee-specific and not auto-feeding the About page as a "report"

### Stage 9 — Polish & Data — partial / ongoing
- No dedicated "gold accents" design pass happened — design converged on maroon+white instead; responsiveness and data entry status not verified in this reconciliation pass

---

## 7. Key Design Decisions — resolved

1. ~~Prototype stack~~ — resolved: React 19 + Vite 6 + Tailwind v4 + Supabase, per §1.
2. **RLS strategy — resolved as recommended.** RLS is the real security boundary (`is_admin()`/`is_staff()`/`has_permission()` SECURITY DEFINER helpers avoid the recursive-policy trap); frontend `hasPermission` gating is UX-only, never assume it protects data on its own.
3. **Instagram embed — status unclear.** Not confirmed in this reconciliation pass; check `Home.jsx`/`Footer.jsx` for the current embed approach (footer social links are now admin-editable via `site_settings.footer_socials`, §3, which may have superseded a fixed embed).
4. **PDF generation — resolved: client-side `jsPDF` + `html2canvas`.** Both are installed dependencies (§1); no Edge Function involved.
5. **Quorum default — resolved as data, not hardcoded.** `site_settings.quorum_type`/`quorum_custom_value` exist and are admin-editable from Admin Settings (§8); confirm the shipped default value in `site_settings` before assuming it's still "half of active members."

---

## 8. Admin Customization System

Everything in this section is SCI/Admin only. All settings persist in Supabase and are read at runtime — no code changes needed for any customization.

### 8A. Admin Settings Page — `/dashboard/admin/:section` (actual tab list differs from the plan)

Built as one unified hub as planned, but the actual tabs (`AdminSettings.jsx`) are more granular than the plan's Tab 1–6 and — critically — **there is no Branding tab**:

`announcements`, `join` (Join SGA form builder + signup toggle), `about` (purpose text), `calendar` (calendar embed URL), `contact` (email/address), `newsletter` (email export), `members` (member + role management, replaces the old Security Clearance page), `tiers` (Permission Tiers), `positions` (Elected Positions), `sections` (Agenda Sections), `meetings` (Meeting Defaults), `candidacy` (elections-v2 admin controls).

Also surfaced contextually inline (e.g. agenda section settings appear in the agenda editor for Admins).

---

#### ~~Tab 1 — Branding~~ — **not built as a live admin UI**
`site_settings.school_name`/`tagline`/`logo_url`/`primary_color`/`accent_color`/`bg_color` still exist as columns (added in the original foundation migration) but there is no admin-facing tab to edit them. The design system was deliberately fixed to **maroon (`#8e231c`) + white only** — `src/index.css` maps legacy `gold`/`accent` Tailwind tokens onto maroon so stray utilities can't reintroduce yellow. Don't build a Branding tab or reintroduce gold/accent colors without confirming this was a deliberate reversal of the original plan, not an oversight.

---

#### Tab — Permission Tiers *(plan's Tab 2, built as `tiers`)*
- List of all tiers with name, order, and permission summary
- **Add tier**: name input → creates row in `roles` table
- **Edit tier**: rename, reorder (drag), toggle individual permission checkboxes
- **Delete tier**: only allowed if no members currently hold that role
- **Admin tier**: one tier is always marked `is_admin = true`; cannot be deleted or have its permissions reduced

**Permission checkboxes available per tier:**

| Key | What it gates |
|---|---|
| `view_directory` | Can see the member directory |
| `edit_directory` | Can edit member dues status (SCI-level toggle) |
| `view_meetings` | Can see meetings list and attend public agenda |
| `create_meetings` | Can create meetings and QR sessions |
| `edit_agendas` | Can use the agenda editor |
| `view_bookkeeping` | Can see bookkeeping accounts they have access to |
| `manage_bookkeeping` | Can create accounts and set visibility (Admin also sets this per account) |
| `view_archives` | Can view archive items at or above their tier |
| `upload_archives` | Can upload to archives |
| `view_elections` | Can see election cycles and results |
| `manage_elections` | Can manage cycles, score candidates, assign positions |
| `edit_site` | Can manage announcements, join toggle, about text |
| `manage_roles` | Can change other members' tiers |
| `manage_committees` | Can create/edit committees |
| `assign_tasks` | Can create/manage assignments (added post-launch, not in original plan) |

Per-member overrides (`profiles.permission_overrides`) also exist on top of tiers — see §2/§3.

---

#### Tab — Elected Positions *(plan's Tab 3, built as `positions`)*
- List of all positions grouped by `group` (Exec, Senior, Junior, Sophomore, Freshman, Custom)
- **Add position**: title, group, order, `show_in_elections` toggle
- **Edit position**: rename, move group, reorder within group, toggle elections visibility
- **Delete position**: only if no member currently holds it
- Positions feed into: member profiles, About page officer sections, election candidacy form
- Also gained `default_role_id` (auto-upgrade the winner's role) and `description`/`requirements` (elections-v2 application checklist) — see §3

---

#### Tab — Join SGA Form Builder *(plan's Tab 4, built as `join`, matches the plan closely)*
- Live preview of the current form alongside the editor
- **Core fields** (always present, cannot be removed): Full name, Student ID, Email, Password, Confirm Password
- **Toggleable default fields**: Grade, Shirt size
- **Custom fields**: Admin can add fields of type:
  - Text input (label, placeholder, required toggle)
  - Dropdown (label, list of options, required toggle)
  - Checkbox (label, required toggle)
- Fields can be reordered (drag)
- Custom field values stored in `profiles.custom_fields` (jsonb)
- Form schema stored in `site_settings.join_form_schema` (jsonb array of field definitions)

**Join form schema shape (stored in `site_settings`):**
```json
[
  { "key": "grade", "type": "select", "label": "Grade", "enabled": true, "required": true,
    "options": ["9", "10", "11", "12"] },
  { "key": "shirt_size", "type": "select", "label": "Shirt Size", "enabled": false, "required": false,
    "options": ["XS", "S", "M", "L", "XL", "XXL"] },
  { "key": "custom_teacher_rec", "type": "text", "label": "Teacher Recommendation",
    "placeholder": "Enter teacher name", "required": false, "custom": true }
]
```

---

#### Tab — Agenda Section Types *(plan's Tab 5, built as `sections`)*
- List of all section types with name and order
- **Default sections** (can rename or reorder, cannot delete if used in existing agendas):
  Opening, Announcements, Reports, Unfinished Business, New Business, Open Floor, Adjournment
- **Add section type**: name input → adds to `agenda_section_types` table
- **Reorder**: drag handles
- **Rename**: inline edit
- New section types appear as options when creating/editing agendas

**New table: `agenda_section_types`**
```
id (uuid)
name (text, unique) — e.g. "Opening", "New Business"
default_order (int) — order when a new agenda is created
is_default (bool) — whether it auto-populates on new agendas
created_at (timestamp)
```
`agenda_sections.section_type` becomes a FK to this table instead of a hardcoded enum.

---

#### Tab 6 — General / Misc — **split into several dedicated tabs instead of one**
The plan's single catch-all tab became separate tabs: `about` (purpose text), `meetings` (quorum + default title format), `newsletter` (email export), `calendar` (calendar embed URL), `contact` (email/address) — see the actual tab list at the top of §8A.

---

### 8B. `site_settings` Table — Updated Schema
This is the original plan's version; see §3 for the fuller, current column list (contact fields, calendar URL, footer socials, elections-v2 columns, etc.) and which of these columns are unused (branding).
```
id (always 1)
school_name (text)
tagline (text)
logo_url (text, nullable)
primary_color (text) — hex
accent_color (text) — hex
bg_color (text) — hex
signup_enabled (bool)
about_purpose_text (text)
quorum_type (text) — half_active | half_officers | custom
quorum_custom_value (int, nullable)
join_form_schema (jsonb) — array of field definition objects
default_meeting_title_format (text)
```

---

### 8C. Build Notes for Admin Customization

- **Branding colors**: the plan's `<style>`-block-from-`site_settings` approach was **not built** — colors are hardcoded maroon+white in `src/index.css` `@theme` tokens instead (see the dropped Branding tab, above). Don't reintroduce runtime color injection without confirming this is wanted.
- **Role permission checks**: built as planned — `hasPermission(key)` (via `AuthContext`, backed by `src/lib/permissions.js`) is the canonical check everywhere, now also consulting `profiles.permission_overrides` before falling back to the role default (§2).
- **Join form rendering**: built as planned, driven entirely by `join_form_schema`.
- **Elected positions**: built as planned, and extended with `default_role_id` (auto role upgrade) and `description`/`requirements` (elections-v2 application checklist) — see §3.
- **Agenda section types**: built as planned (`agenda_items.section` FKs to `agenda_section_types`).

---

## 9. Stage 9–10 Status

### Stage 9 — Admin Settings Panel — mostly built, Branding intentionally dropped
- ~~Branding tab~~ — not built; design fixed to maroon+white (see §8)
- Permission Tiers, Elected Positions, Join Form Builder, Agenda Section Types tabs — built as planned
- General tab — split into `about`/`meetings`/`newsletter`/`calendar`/`contact` tabs instead of one (§8A)

### Stage 10 — Polish & Data — not independently verified in this reconciliation pass
- Responsive layout, manual data entry, and permission-gate QA status unknown as of 2026-09-06 — check with whoever last worked on the repo rather than assuming from this doc
- No "final design pass" toward gold accents happened — the design converged on maroon+white only (a deliberate reversal of the original palette plan, not a TODO)