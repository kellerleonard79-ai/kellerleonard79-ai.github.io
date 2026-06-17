import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  CalendarCheck,
  ClipboardList,
  Vote,
  Wallet,
  Archive,
  UsersRound,
  Settings2,
  ArrowUpRight,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'

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
    title: 'Admin Panel',
    desc: 'Site, members, branding and settings',
    icon: Settings2,
    to: '/dashboard/admin',
    // Reachable by anyone with at least one admin-area permission; the panel
    // itself narrows to the sections they can use.
    anyPermission: ['edit_site', 'manage_roles'],
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

  // Existing members aren't flagged as candidates, so they'd otherwise have no
  // visible path to declare candidacy when a cycle opens. Check whether filing
  // is open so we can surface a "Run for a Position" card to everyone.
  const [cycleOpen, setCycleOpen] = useState(false)
  useEffect(() => {
    let active = true
    supabase.rpc('my_candidacy').then(({ data }) => {
      if (active) setCycleOpen(Boolean(data?.cycle_open))
    })
    return () => {
      active = false
    }
  }, [])

  // Pending applicants who got in to manage a candidacy don't get the full hub —
  // just a notice and (if they're running) a link to their candidacy page.
  if (profile?.status === 'pending') {
    return <PendingHub profile={profile} firstName={firstName} signOut={signOut} />
  }

  // A card shows when: it has no gate; the viewer holds its `permission`; or the
  // viewer holds any of its `anyPermission` list. Otherwise it's hidden.
  const cards = CARDS.filter((card) => {
    if (card.permission) return hasPermission(card.permission)
    if (card.anyPermission) return card.anyPermission.some(hasPermission)
    return true
  })

  // Members who are running for a position get a self-service candidacy card,
  // plus the full application checklist (position, rules, endorsements, interview).
  if (profile?.is_candidate_application) {
    cards.unshift(
      {
        title: 'My Application',
        desc: 'Complete your election application checklist',
        icon: ClipboardList,
        to: '/dashboard/application',
      },
      {
        title: 'My Candidacy',
        desc: 'Choose or change the position you’re running for',
        icon: Vote,
        to: '/dashboard/candidacy',
      },
    )
  } else if (cycleOpen) {
    // Already-approved members who haven't declared yet: give them a clear way
    // in to run for a position while filing is open.
    cards.unshift({
      title: 'Run for a Position',
      desc: 'Filing is open — declare your candidacy',
      icon: Vote,
      to: '/dashboard/candidacy',
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
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

function PendingHub({ profile, firstName, signOut }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Welcome, {profile?.full_name ?? firstName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Pending approval
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

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-600">
            Your membership is awaiting officer approval. Once an SGA officer
            approves your account, your full dashboard will unlock here.
          </p>
          {profile?.is_candidate_application && (
            <>
              <p className="mt-3 text-gray-600">
                In the meantime, you can choose or update the position
                you&apos;re running for.
              </p>
              <Link
                to="/dashboard/candidacy"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
              >
                <Vote className="h-4 w-4" /> Manage my candidacy
              </Link>
            </>
          )}
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
