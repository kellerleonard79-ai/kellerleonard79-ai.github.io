import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Search, ArrowRight, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { gradeLabel } from '../lib/format.js'

export default function MemberDirectory() {
  return (
    <RequireStaff>
      <DirectoryContent />
    </RequireStaff>
  )
}

function DirectoryContent() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, student_id, grade_level, position, clearance_level, status')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setMembers(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return members
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(term) ||
        m.student_id?.toLowerCase().includes(term),
    )
  }, [members, query])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Member Directory
            </h1>
            <p className="mt-1 text-gray-500">
              {loading ? 'Loading…' : `${members.length} registered members`}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/50 px-5 py-8 text-center text-sm text-gray-400">
            {query ? 'No members match your search.' : 'No members yet.'}
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/dashboard/members/${m.id}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-maroon/30 hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-maroon/10 font-display text-sm font-bold text-maroon">
                      {initials(m.full_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {m.full_name ?? 'Member'}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {[
                          m.position,
                          gradeLabel(m.grade_level),
                          m.student_id && `ID ${m.student_id}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-maroon" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Footer />
    </div>
  )
}

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
