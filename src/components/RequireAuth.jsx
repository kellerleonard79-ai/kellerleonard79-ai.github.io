import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Navbar from './Navbar.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

// Gates a route to any signed-in member (regardless of clearance). Signed-out
// users are sent to login and returned here afterward.
export default function RequireAuth({ children }) {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/login?redirect=${pathname}`, { replace: true })
    }
  }, [loading, session, pathname, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </div>
    )
  }

  if (!session) return null // redirecting to login

  return children
}
