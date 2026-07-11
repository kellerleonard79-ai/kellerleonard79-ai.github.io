import { Link } from 'react-router-dom'
import { Vote, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'

// Landing pane for /dashboard (the index route inside DashboardLayout). The
// sidebar is the shell's navigation — this is just a light welcome, or the
// pending-approval notice for applicants awaiting officer review.
export default function Dashboard() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Tiger'

  if (profile?.status === 'pending') {
    return <PendingWelcome profile={profile} firstName={firstName} />
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-maroon">
          Welcome, {profile?.full_name ?? firstName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center rounded-full bg-maroon/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-maroon">
            {profile?.clearance_level ?? 'member'}
          </span>
          {profile?.student_id && <span>ID {profile.student_id}</span>}
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-maroon/8 text-maroon">
          <LayoutDashboard className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold text-maroon">
          Your tools are in the sidebar
        </h2>
        <p className="mt-2 max-w-prose text-gray-600">
          Use the menu on the left to jump between the directory, meetings,
          archives, and anything else your role can access. Everything stays one
          click away.
        </p>
      </div>
    </div>
  )
}

function PendingWelcome({ profile, firstName }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-maroon">
          Welcome, {profile?.full_name ?? firstName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pending approval
          </span>
          {profile?.student_id && <span>ID {profile.student_id}</span>}
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-600">
          Your membership is awaiting officer approval. Once an SGA officer
          approves your account, your full dashboard will unlock here.
        </p>
        {profile?.is_candidate_application && (
          <>
            <p className="mt-3 text-gray-600">
              In the meantime, you can choose or update the position you&apos;re
              running for.
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
  )
}
