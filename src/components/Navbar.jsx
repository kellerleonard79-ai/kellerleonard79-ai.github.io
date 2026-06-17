import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, LogIn, LogOut, UserPlus, LayoutDashboard, UserCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// Links with a `to` are real routes (React Router); the rest are placeholder
// on-page anchors for pages you'll build later.
const links = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Elections', to: '/elections' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { session, loading, signOut } = useAuth()
  const { settings } = useSiteSettings()
  const signupEnabled = settings?.signup_enabled ?? false

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center">
          <img
            src="/maroon-phs-sga-logo.png"
            alt="Pensacola High School Student Government Association"
            className="h-9 w-auto shrink-0 object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l, i) => {
            const cls = `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              i === 0
                ? 'text-maroon'
                : 'text-gray-600 hover:bg-maroon/5 hover:text-maroon'
            }`
            return l.to ? (
              <Link key={l.label} to={l.to} className={cls}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} className={cls}>
                {l.label}
              </a>
            )
          })}

          {session && (
            <Link
              to="/dashboard"
              className="ml-2 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
            >
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          )}

          {session && (
            <Link
              to="/dashboard/profile"
              className="ml-2 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
            >
              <UserCircle className="h-4 w-4" /> My Profile
            </Link>
          )}

          {/* Until auth resolves (`loading`), render a neutral placeholder
              rather than the logged-out CTA — otherwise pages briefly flash
              "Member Login" before the session is read, making members think
              they were signed out. */}
          {loading ? (
            <span className="ml-1 inline-flex h-9 w-9 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-maroon/50" />
            </span>
          ) : session ? (
            <button
              onClick={signOut}
              className="ml-1 inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          ) : (
            <>
              {signupEnabled && (
                <Link
                  to="/join"
                  className="ml-2 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
                >
                  <UserPlus className="h-4 w-4" /> Join SGA
                </Link>
              )}
              <Link
                to="/login"
                className="ml-1 inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
              >
                <LogIn className="h-4 w-4" /> Member Login
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center justify-center rounded-md p-2 text-maroon lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-gray-200 bg-white lg:hidden">
          <div className="space-y-1 px-4 py-3">
            {links.map((l) => {
              const cls =
                'block rounded-md px-3 py-2 text-base font-medium text-maroon hover:bg-maroon/5 hover:text-maroon'
              return l.to ? (
                <Link
                  key={l.label}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cls}
                >
                  {l.label}
                </a>
              )
            })}

            {session && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-maroon px-4 py-2 text-base font-semibold text-maroon"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            )}

            {session && (
              <Link
                to="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-maroon px-4 py-2 text-base font-semibold text-maroon"
              >
                <UserCircle className="h-4 w-4" /> My Profile
              </Link>
            )}

            {/* Mirror the desktop behavior: no logged-out CTA until auth
                resolves, so the menu never flashes "Member Login". */}
            {loading ? (
              <div className="mt-2 flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-maroon/50" />
              </div>
            ) : session ? (
              <button
                onClick={() => {
                  setOpen(false)
                  signOut()
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <>
                {signupEnabled && (
                  <Link
                    to="/join"
                    onClick={() => setOpen(false)}
                    className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-maroon px-4 py-2 text-base font-semibold text-maroon"
                  >
                    <UserPlus className="h-4 w-4" /> Join SGA
                  </Link>
                )}
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white"
                >
                  <LogIn className="h-4 w-4" /> Member Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
