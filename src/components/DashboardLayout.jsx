import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Users,
  CalendarCheck,
  Crown,
  Vote,
  Wallet,
  Archive,
  UsersRound,
  Settings2,
  ClipboardList,
  LayoutDashboard,
  UserCircle,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { useStuckLoading } from '../lib/useStuckLoading.js'

// The tool set shown to approved members, in sidebar order. Gating mirrors each
// destination page's own guard (view_* permissions, RequirePermission) so the
// sidebar only offers what the member can actually open. Committees and
// Assignments are open to any signed-in member, so they carry no gate.
//
// `show` is for entries that depend on something other than a permission — My
// Application appears only while an election cycle is running. Keeping it in
// this array (rather than splicing it in afterwards) is what lets it sit in the
// middle of the list.
const TOOLS = [
  { label: 'Meetings', to: '/dashboard/meetings', icon: CalendarCheck, permission: 'view_meetings' },
  { label: 'Archives', to: '/dashboard/archives', icon: Archive, permission: 'view_archives' },
  { label: 'Member Directory', to: '/dashboard/members', icon: Users, permission: 'view_directory' },
  { label: 'SGA Elections', to: '/dashboard/elections', icon: Vote, permission: 'view_elections' },
  { label: 'Court Elections', to: '/dashboard/court', icon: Crown, permission: 'manage_court' },
  { label: 'My Application', to: '/dashboard/application', icon: ClipboardList, show: (ctx) => ctx.cycleActive },
  { label: 'Bookkeeping', to: '/dashboard/bookkeeping', icon: Wallet, permission: 'view_bookkeeping' },
  { label: 'Committees', to: '/dashboard/committees', icon: UsersRound },
  { label: 'Assignments', to: '/dashboard/assignments', icon: ClipboardList },
  { label: 'Edit Site', to: '/dashboard/edit-site', icon: Settings2, permission: 'edit_site' },
]

// Persistent shell for every /dashboard/* route. Rendered once as a layout
// route so the sidebar stays mounted across navigation (no remount, no flash).
// Owns the auth gate that each page used to carry via RequireAuth.
export default function DashboardLayout() {
  const { loading, session, profile, signOut, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const stuck = useStuckLoading(loading)

  // Auth gate for the whole shell — replaces the per-page RequireAuth wrappers.
  useEffect(() => {
    if (!loading && !session) {
      navigate(`/login?redirect=${pathname}`, { replace: true })
    }
  }, [loading, session, pathname, navigate])

  // Close the mobile drawer on every navigation so it never lingers open.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Whether an election cycle is running at all, which is what gates the "My
  // Application" entry. Deliberately cycle_active and not cycle_open: the
  // latter also requires the filing deadline to be in the future, so it would
  // hide the entry from candidates who have already filed but still owe
  // endorsements and an interview booking.
  const [cycleActive, setCycleActive] = useState(false)
  useEffect(() => {
    let active = true
    supabase.rpc('my_candidacy').then(({ data }) => {
      if (active) setCycleActive(Boolean(data?.cycle_active))
    })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        {stuck && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-gray-500">This is taking longer than expected.</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!session) return null // redirecting to login

  const pending = profile?.status === 'pending'

  // Build the nav item list. Pending applicants get the approval notice (the
  // landing pane) and no tools — except the candidacy picker, which is the one
  // thing they can still act on, so they are never left with nowhere to go.
  const items = [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true }]

  if (pending) {
    if (profile?.is_candidate_application) {
      items.push({ label: 'My Candidacy', to: '/dashboard/application', icon: Vote })
    }
  } else {
    for (const tool of TOOLS) {
      if (tool.permission && !hasPermission(tool.permission)) continue
      if (tool.show && !tool.show({ cycleActive })) continue
      items.push(tool)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar — sticky full height, hidden in print output. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex print:hidden">
        <SidebarNav items={items} profile={profile} signOut={signOut} />
      </aside>

      {/* Mobile drawer + overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-gray-200 bg-white shadow-xl">
            <SidebarNav
              items={items}
              profile={profile}
              signOut={signOut}
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with the hamburger that opens the drawer. */}
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 lg:hidden print:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center justify-center rounded-md p-2 text-maroon"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/dashboard" className="flex items-center">
            <img
              src="/maroon-phs-sga-logo.png"
              alt="Pensacola High School Student Government Association"
              className="h-8 w-auto object-contain"
            />
          </Link>
          {/* Spacer to keep the logo centered against the hamburger. */}
          <span className="w-10" aria-hidden="true" />
        </div>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Shared sidebar body used by both the desktop rail and the mobile drawer.
function SidebarNav({ items, profile, signOut, onClose }) {
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Tiger'

  return (
    <div className="flex h-full flex-col">
      {/* Brand / header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <Link to="/" className="flex items-center">
          <img
            src="/maroon-phs-sga-logo.png"
            alt="Pensacola High School Student Government Association"
            className="h-9 w-auto object-contain"
          />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-maroon lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-maroon text-white'
                  : 'text-gray-600 hover:bg-maroon/5 hover:text-maroon'
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile + sign out */}
      <div className="border-t border-gray-200 p-3">
        <NavLink
          to="/dashboard/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 transition ${
              isActive ? 'bg-maroon/10' : 'hover:bg-maroon/5'
            }`
          }
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon/10 text-maroon">
            <UserCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-maroon">
              {profile?.full_name ?? firstName}
            </span>
            <span className="block truncate text-xs uppercase tracking-wide text-gray-400">
              {profile?.status === 'pending'
                ? 'Pending approval'
                : profile?.clearance_level ?? 'member'}
            </span>
          </span>
        </NavLink>
        <button
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-maroon/5 hover:text-maroon"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" /> Sign out
        </button>
      </div>
    </div>
  )
}
