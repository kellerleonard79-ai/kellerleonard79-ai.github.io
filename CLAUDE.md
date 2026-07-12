# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A broader product/feature plan lives at `../CLAUDE.md` (the "Nexus 2.0" project plan). This file documents what is actually built in this repo.

## Project

PHS SGA ("Nexus") — a single React SPA serving both the public site and the logged-in officer dashboard for the Pensacola High School Student Government Association. Backend is Supabase (Postgres + Auth + Storage + Edge Functions). Hosted on GitHub Pages at the domain root (`kellerleonard79-ai.github.io`).

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # vite build, then copies dist/index.html -> dist/404.html (SPA fallback)
npm run preview    # preview the production build locally
```

There is no test suite, linter, or formatter configured. The `build` script's `cp dist/index.html dist/404.html` step is load-bearing for client-side routing on GitHub Pages — keep it.

Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).

## Deployment

- **Frontend**: `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main`. Supabase env vars come from repo secrets.
- **Edge Functions**: `.github/workflows/deploy-functions.yml` deploys every function under `supabase/functions/` on push to `main` (when those paths change). Project ref is `igwmqvsfqgtkhrtdvwwq`; needs the `SUPABASE_ACCESS_TOKEN` repo secret.
- **Migrations are not auto-applied.** New files in `supabase/migrations/` must be applied to the hosted DB manually (via the Supabase CLI/dashboard). Always check existing migrations before adding tables/columns to avoid conflicts.

## Architecture

### Routing & app shell
- `src/main.jsx` mounts `BrowserRouter` → `SiteSettingsProvider` → `AuthProvider` → `App`. Provider order matters: settings load independent of auth; auth wraps the routed app.
- Despite GitHub Pages, routing uses `BrowserRouter` (not hash routing); the `404.html` copy is what makes deep links and refreshes work.
- `src/App.jsx` is the full route table. Pages live in `src/pages/`, shared pieces in `src/components/`, cross-cutting logic in `src/lib/`.
- **All `/dashboard/*` routes nest under a single layout route (`src/components/DashboardLayout.jsx`)** that renders a persistent left sidebar + `<Outlet/>`. The sidebar stays mounted across navigation (no remount), lists the tools the signed-in member can access (gated by `hasPermission`/`anyPermission`, mirroring each page's own guard), and owns profile + sign-out. `/dashboard` itself is the index route — a light welcome pane (`Dashboard.jsx`), not a card hub. `/checkin/:meetingId` is intentionally left **outside** the shell (public QR landing). Dashboard pages therefore render only their own content — no `Navbar`/`Footer`/`RequireAuth` of their own.
- Legacy routes (`/dashboard/edit-site`, `/dashboard/security`) now `<Navigate>` to sections of the unified `AdminSettings` page (`/dashboard/admin/:section`).

### Auth & permissions (the central abstraction)
- `src/lib/AuthContext.jsx` (`useAuth`) loads the Supabase session and the user's `profiles` row joined with its `roles` row (`select('*, role:roles(*)')`). The role carries a `permissions` jsonb and an `is_admin` flag.
- **`hasPermission(key)` is the canonical access check used everywhere.** Admin roles (`is_admin`) pass every check; no role denies everything. Permission keys are strings like `create_meetings`, `view_elections`, `manage_bookkeeping`, etc. Prefer `hasPermission` over inspecting roles directly.
- Route/section gating components in `src/components/`:
  - `DashboardLayout` — the shell itself: gates the whole `/dashboard/*` area to any signed-in member (redirects signed-out users to `/login?redirect=...`). This is why dashboard pages no longer need their own `RequireAuth`.
  - `RequirePermission permission="key"` — gates one page on a single permission key; shows an access-denied screen (rendered *inside* the shell — it no longer draws its own `Navbar`) to members whose role lacks it. Direct-URL protection, since the sidebar already hides tools a member can't open.
  - `RequireStaff` — thin wrapper = `RequirePermission permission="create_meetings"` (i.e. "officers who can run meetings").
- The shell provides the auth gate; **per-page permission gating still lives inside each page component** (pages that need a specific permission wrap their content in `RequirePermission`/`RequireStaff`), not in `App.jsx`. New protected dashboard pages should keep doing this and rely on the layout for auth + chrome.
- `clearance_level` (`member`/`officer`/`admin`) is a **legacy** column still synced for back-compat (e.g. in the `create-user` function). The roles/permissions system is the source of truth; don't add new logic keyed on `clearance_level`.

### Site settings & branding
- `src/lib/SiteSettingsContext.jsx` (`useSiteSettings`) loads the single-row `site_settings` table and injects admin-configured brand colors into CSS custom properties at runtime (`--color-primary`/`--color-maroon`, etc.). Call `refresh()` after an admin saves settings so the whole app re-themes live.
- The design system is intentionally **maroon (#8e231c) + white only**. `src/index.css` (Tailwind v4 `@theme`) maps all legacy `gold`/`accent` tokens onto maroon so stray utilities degrade to brand color instead of yellow. Don't introduce gold/accent colors.
- Tailwind v4 is configured via the Vite plugin and `@theme` in `src/index.css` — there is **no `tailwind.config.js`**. Fonts: League Spartan (display, uppercased headings) + Inter (body).

### Supabase access patterns
- `src/lib/supabaseClient.js` exports **two** clients: the default `supabase` (persists session, auto-refreshes) and a named `supabasePublic` (session-less, no auto-refresh, separate `storageKey`). Use `supabasePublic` for public/anonymous reads (homepage, about, public elections, site settings/branding) so public content keeps loading even if a logged-in session is wedged. Most data access is direct `supabase.from(...)` calls from page components, gated by RLS server-side.
- **Clock-skew compensation is built into the auth layer.** A wrong device clock breaks Supabase auth (auth-js compares the JWT's server-set expiry against `Date.now()`). `src/lib/clockCheck.js` measures device-vs-server skew via a `server_now()` RPC; `supabaseClient.js` wraps localStorage to re-express token expiry in the device's clock frame; `ClockWarning.jsx` banners the user. `AuthContext` awaits the skew measurement before reading the session. Don't "simplify" this away — it's load-bearing for users with misconfigured clocks/time zones.
- **RLS is the real security boundary.** Migrations enable Row Level Security and rely on a `public.is_admin()` SECURITY DEFINER helper (avoids the recursive-policy trap of a profiles policy querying profiles). Frontend `hasPermission` gating is for UX; never assume it protects data.
- **Edge Functions** (`supabase/functions/`, Deno) handle privileged operations that must bypass RLS with the service-role key, always after re-verifying the caller via `is_admin()` RPC:
  - `create-user` / `delete-user` — admin-driven account lifecycle.
  - `agenda-file-url`, `archive-file-url`, `task-file-url` — signed Storage URLs for restricted files.
  - Called from the client via `supabase.functions.invoke('name', ...)`.
- **Login is by student ID**, not email. Supabase Auth only knows emails, so `Login` calls the `email_for_student_id(p_student_id)` SECURITY DEFINER RPC to resolve the email, then `signInWithPassword`. That RPC intentionally exposes only the email for one matching student_id.

### Feature areas (one page module each)
Public: `Home`, `About`, `Join` (signup gated by `site_settings.signup_enabled`), `ElectionsPublic`, `Login`. Dashboard: `Dashboard` (permission-gated card grid), `MemberDirectory`, `Profile` (own + `/members/:id` admin edit), `Meetings`/`MeetingDetail`/`AgendaEditor`/`SessionView` (+ public `Checkin/:meetingId` QR flow), `Elections`/`Candidacy`/`ApplicationDashboard`, `Bookkeeping`, `Archives`, `Committees`, `Assignments`, and `AdminSettings` (unified admin hub: branding, roles/permissions, positions, join-form builder, members, announcements, etc.).
- **Committees vs Assignments split**: Committees is the org chart (roster/chair/description; Manage mode gated on `manage_committees`). Assignments is ALL work — an assignment is a `tasks` row plus an explicit assignee snapshot in `task_assignees` (committee/grade pickers are just shortcuts; joining a committee later does not inherit its tasks). `task_submissions` is the app's **only** submission mechanism (`requires_each` controls whether everyone or any one assignee must submit); authoring is gated on `assign_tasks`. Don't add task lists or submission forms anywhere else.

## Conventions
- Roles, elected positions, and agenda section types are **data, not enums** — they live in DB tables and are admin-editable. Don't hardcode role names, position titles, or section types.
- PDF export (agenda/attendance) is client-side via `jspdf` + `html2canvas`.
- QR codes via `qrcode.react` (`CheckinQR.jsx`); icons via `lucide-react` (custom ones in `BrandIcons.jsx`). User-authored rich text renders through `Markdown.jsx`.
- The big pages are large single files (e.g. `AdminSettings.jsx` ~2700 lines, `AgendaEditor.jsx` ~1560, `Elections.jsx` ~1500). Each owns its own data fetching, state, and sub-components inline rather than splitting into many files — follow the existing file's structure when editing rather than refactoring it apart.
- Comments in this codebase explain *why* (non-obvious constraints like the GitHub Pages routing trick, RLS recursion avoidance, legacy-column syncing) — match that style; explain rationale, not mechanics.
