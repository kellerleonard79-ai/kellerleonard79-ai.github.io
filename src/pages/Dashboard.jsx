import { Link } from 'react-router-dom'
import {
  Users,
  CalendarCheck,
  Globe,
  UserCircle,
  Vote,
  Wallet,
  ShieldCheck,
  Archive,
  UsersRound,
  Settings2,
  ArrowUpRight,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

const CARDS = [
  {
    title: 'Member Directory',
    desc: 'Search and filter all members',
    icon: Users,
    to: '/dashboard/members',
  },
  {
    title: 'Meetings',
    desc: 'Agendas, attendance and QR',
    icon: CalendarCheck,
    to: '/dashboard/meetings',
  },
  {
    title: 'Edit Public Site',
    desc: 'Announcements and settings',
    icon: Globe,
    to: '/dashboard/edit-site',
    permission: 'edit_site',
  },
  {
    title: 'My Profile',
    desc: 'Your info and attendance',
    icon: UserCircle,
    to: '/dashboard/profile',
  },
  {
    title: 'Security Clearance',
    desc: 'Approvals and member roles',
    icon: ShieldCheck,
    to: '/dashboard/security',
    permission: 'manage_roles',
  },
  {
    title: 'Archives',
    desc: 'Documents and resources',
    icon: Archive,
    to: '/dashboard/archives',
    permission: 'view_archives',
  },
  {
    title: 'Elections',
    desc: 'Cycles, candidates and results',
    icon: Vote,
    to: '/dashboard/elections',
    permission: 'view_elections',
  },
  {
    title: 'Bookkeeping',
    desc: 'Accounts, ledgers and balances',
    icon: Wallet,
    to: '/dashboard/bookkeeping',
    permission: 'view_bookkeeping',
  },
  {
    title: 'Committees',
    desc: 'Members, chairs and reports',
    icon: UsersRound,
    to: '/dashboard/committees',
  },
  {
    title: 'Admin Settings',
    desc: 'Branding, tiers, forms and more',
    icon: Settings2,
    to: '/dashboard/admin',
    permission: 'manage_roles',
  },
]

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardHub />
    </RequireAuth>
  )
}

function DashboardHub() {
  const { profile, signOut, hasPermission } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Tiger'

  // Cards with a `permission` are only shown to roles that hold it; cards
  // without one are visible to everyone who can reach the dashboard.
  const cards = CARDS.filter(
    (card) => !card.permission || hasPermission(card.permission),
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Welcome, {profile?.full_name ?? firstName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-flex items-center rounded-full bg-maroon/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-maroon">
                {profile?.clearance_level ?? 'member'}
              </span>
              {profile?.student_id && <span>ID {profile.student_id}</span>}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            Sign out
          </button>
        </header>

        {/* Compact vertical list */}
        <div className="mt-8 flex flex-col gap-2">
          {cards.map((card) => (
            <DashboardCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      <Footer />
    </div>
  )
}

function DashboardCard({ title, desc, icon: Icon, to }) {
  const available = Boolean(to)

  const inner = (
    <>
      {/* accent bar that grows on hover */}
      <span className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-maroon transition-transform duration-300 group-hover:scale-y-100" />

      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-maroon/8 text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
        <Icon className="h-4.5 w-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-sm font-bold text-maroon">{title}</h2>
        <p className="truncate text-xs text-gray-500">{desc}</p>
      </div>

      {available ? (
        <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-maroon" />
      ) : (
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Soon
        </span>
      )}
    </>
  )

  const base =
    'group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3 shadow-sm transition'

  if (!available) {
    return (
      <div className={`${base} cursor-default border-gray-200 opacity-70`}>
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={`${base} border-gray-200 hover:border-maroon/30 hover:shadow-md`}
    >
      {inner}
    </Link>
  )
}
