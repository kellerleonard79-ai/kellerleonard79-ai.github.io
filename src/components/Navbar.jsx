import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, LogIn, UserPlus } from 'lucide-react'
import Crest from './Crest.jsx'

// Placeholder routes for the other pages you'll build later.
const links = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Officers', href: '#officers' },
  { label: 'Events', href: '#events' },
  { label: 'Resources', href: '#resources' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <Crest className="h-11 w-11 shrink-0 object-contain" />
          <span className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gold">
              Pensacola High School
            </span>
            <span className="font-display text-lg font-bold text-maroon">
              Student Government
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l, i) => (
            <a
              key={l.label}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                i === 0
                  ? 'text-maroon'
                  : 'text-gray-600 hover:bg-maroon/5 hover:text-maroon'
              }`}
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/join"
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
          >
            <UserPlus className="h-4 w-4" /> Join SGA
          </Link>
          <a
            href="#login"
            className="ml-1 inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
          >
            <LogIn className="h-4 w-4" /> Member Login
          </a>
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
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-maroon/5 hover:text-maroon"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/join"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-maroon px-4 py-2 text-base font-semibold text-maroon"
            >
              <UserPlus className="h-4 w-4" /> Join SGA
            </Link>
            <a
              href="#login"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white"
            >
              <LogIn className="h-4 w-4" /> Member Login
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
