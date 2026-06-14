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
    <div className="min-h-screen bg-mist">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <span className="eyebrow">Officer Dashboard</span>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              Welcome, {profile?.full_name ?? firstName}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-mute">
              <span className="badge-soft">
                {profile?.clearance_level ?? 'member'}
              </span>
              {profile?.student_id && <span>ID {profile.student_id}</span>}
            </p>
          </div>
          <button onClick={signOut} className="btn-ghost btn-sm">
            Sign out
          </button>
        </header>

        {/* Card grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-maroon transition-transform duration-300 group-hover:scale-x-100" />

      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-tint text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
          <Icon className="h-5 w-5" />
        </span>
        {available ? (
          <ArrowUpRight className="h-5 w-5 text-line-strong transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-maroon" />
        ) : (
          <span className="badge-soft">Soon</span>
        )}
      </div>

      <h2 className="mt-4 font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-ink-mute">{desc}</p>
    </>
  )

  const base = 'group relative overflow-hidden card p-5'

  if (!available) {
    return (
      <div className={`${base} cursor-default opacity-70`}>{inner}</div>
    )
  }

  return (
    <Link
      to={to}
      className={`${base} transition-all duration-200 hover:-translate-y-0.5 hover:border-maroon/35 hover:shadow-[var(--shadow-lift)]`}
    >
      {inner}
    </Link>
  )
}
