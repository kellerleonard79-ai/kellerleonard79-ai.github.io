import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'

// Gates a route on a single permission key (checked via hasPermission). Sends
// signed-out users to login (returning them here afterward) and shows an
// access-denied screen to members whose role lacks the permission.
export default function RequirePermission({ permission, children }) {
  const { loading, session, profile, hasPermission } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/login?redirect=${pathname}`, { replace: true })
    }
  }, [loading, session, pathname, navigate])

  if (loading) {
    return (
      <Gate
        icon={<Loader2 className="h-8 w-8 animate-spin text-maroon" />}
        title="Loading…"
      />
    )
  }

  if (!session) return null // redirecting to login

  if (!hasPermission(permission)) {
    return (
      <Gate
        icon={<Lock className="h-10 w-10 text-maroon" />}
        title="Access restricted"
        sub={`Your account (${profile?.clearance_level ?? 'member'}) doesn't have access to this tool. Ask an admin to upgrade your clearance level.`}
        action={
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-lg bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-maroon-dark"
          >
            Back to Dashboard
          </Link>
        }
      />
    )
  }

  return children
}

// Renders inside the dashboard shell (DashboardLayout provides the chrome), so
// this is just the centered gate message — no Navbar of its own.
function Gate({ icon, title, sub, action }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      {icon}
      <h1 className="mt-4 font-display text-2xl font-bold text-maroon">
        {title}
      </h1>
      {sub && <p className="mt-2 text-gray-600">{sub}</p>}
      {action}
    </div>
  )
}
