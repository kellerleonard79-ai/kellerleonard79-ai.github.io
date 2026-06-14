import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LogIn, LogOut, UserPlus, LayoutDashboard, UserCircle } from 'lucide-react'
import Crest from './Crest.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

const links = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { session, isStaff, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md">
      {/* Heraldic top rule */}
      <div className="h-[3px] w-full bg-maroon" />

      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand lockup */}
        <Link to="/" className="group flex items-center gap-3">
          <Crest className="h-11 w-11 shrink-0 object-contain transition-transform duration-300 group-hover:scale-105" />
          <span className="flex flex-col leading-none">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-mute">
              Pensacola High School
            </span>
            <span className="mt-1 font-display text-[19px] font-semibold leading-none tracking-tight text-maroon">
              Student Government
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = l.to === pathname
            return (
              <Link
                key={l.label}
                to={l.to}
                className={`relative rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? 'text-maroon' : 'text-ink-soft hover:text-maroon'
                }`}
              >
                {l.label}
                <span
                  className={`absolute inset-x-3 -bottom-px h-0.5 origin-left bg-maroon transition-transform duration-300 ${
                    active ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </Link>
            )
          })}

          <span className="mx-2 h-5 w-px bg-line" />

          {isStaff && (
            <Link to="/dashboard" className="btn-ghost btn-sm">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          )}

          {session && (
            <Link to="/dashboard/profile" className="btn-outline btn-sm">
              <UserCircle className="h-4 w-4" /> Profile
            </Link>
          )}

          {session ? (
            <button onClick={signOut} className="btn-primary btn-sm">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          ) : (
            <>
              <Link to="/join" className="btn-outline btn-sm">
                <UserPlus className="h-4 w-4" /> Join SGA
              </Link>
              <Link to="/login" className="btn-primary btn-sm">
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
        <div className="border-b border-line bg-white lg:hidden">
          <div className="space-y-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-semibold text-ink-soft hover:bg-mist hover:text-maroon"
              >
                {l.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-line" />

            {isStaff && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="btn-ghost w-full justify-center"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            )}

            {session && (
              <Link
                to="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="btn-outline mt-2 w-full justify-center"
              >
                <UserCircle className="h-4 w-4" /> My Profile
              </Link>
            )}

            {session ? (
              <button
                onClick={() => {
                  setOpen(false)
                  signOut()
                }}
                className="btn-primary mt-2 w-full justify-center"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <>
                <Link
                  to="/join"
                  onClick={() => setOpen(false)}
                  className="btn-outline mt-2 w-full justify-center"
                >
                  <UserPlus className="h-4 w-4" /> Join SGA
                </Link>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="btn-primary mt-2 w-full justify-center"
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
