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
  ArrowUpRight,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
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
    desc: 'Manage applications',
    icon: Vote,
    to: null,
  },
  {
    title: 'Bookkeeping',
    desc: 'View finances',
    icon: Wallet,
    to: null,
  },
]

export default function Dashboard() {
  return (
    <RequireStaff>
      <DashboardHub />
    </RequireStaff>
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
            <h1 className="font-display text-3xl font-bold text-gray-900">
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

        {/* Card grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      {/* gold accent bar that grows on hover */}
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-gold to-gold-light transition-transform duration-300 group-hover:scale-x-100" />

      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-maroon/8 text-maroon transition-colors group-hover:bg-maroon group-hover:text-gold">
          <Icon className="h-5 w-5" />
        </span>
        {available ? (
          <ArrowUpRight className="h-5 w-5 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-maroon" />
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Soon
          </span>
        )}
      </div>

      <h2 className="mt-4 font-display text-lg font-bold text-gray-900">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-gray-500">{desc}</p>
    </>
  )

  const base =
    'group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition'

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
      className={`${base} border-gray-200 hover:-translate-y-0.5 hover:border-maroon/30 hover:shadow-md`}
    >
      {inner}
    </Link>
  )
}
