import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Search, ArrowRight, Loader2, Circle, CircleCheck } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { gradeLabel } from '../lib/format.js'

export default function MemberDirectory() {
  return (
    <RequireStaff>
      <DirectoryContent />
    </RequireStaff>
  )
}

function DirectoryContent() {
  const { hasPermission } = useAuth()
  const canEditDues = hasPermission('edit_directory')

  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [unexcused, setUnexcused] = useState({}) // profile_id -> unexcused count
  const [loading, setLoading] = useState(true)

  // Filters
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name') // name | worst (most unexcused first)
  const [duesFilter, setDuesFilter] = useState('all') // all | paid | unpaid
  const [roleFilter, setRoleFilter] = useState('all') // all | <role_id>

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: r }, { data: att }] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, full_name, student_id, grade_level, position, role_id, dues_paid, status, role:roles(name)',
          )
          .order('full_name', { ascending: true }),
        supabase.from('roles').select('id, name').order('order', { ascending: true }),
        // Staff can read all attendance (RLS). Tally unexcused absences per member.
        supabase.from('attendance').select('profile_id').eq('status', 'unexcused'),
      ])
      const counts = {}
      for (const row of att ?? []) {
        counts[row.profile_id] = (counts[row.profile_id] ?? 0) + 1
      }
      setMembers(m ?? [])
      setRoles(r ?? [])
      setUnexcused(counts)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleDues(member) {
    const next = !member.dues_paid
    // Optimistic flip, reconcile on failure.
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, dues_paid: next } : m)),
    )
    const { error } = await supabase
      .from('profiles')
      .update({ dues_paid: next })
      .eq('id', member.id)
    if (error) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, dues_paid: !next } : m,
        ),
      )
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    let list = members.filter((m) => {
      if (
        term &&
        !m.full_name?.toLowerCase().includes(term) &&
        !m.student_id?.toLowerCase().includes(term)
      )
        return false
      if (duesFilter === 'paid' && !m.dues_paid) return false
      if (duesFilter === 'unpaid' && m.dues_paid) return false
      if (roleFilter !== 'all' && m.role_id !== roleFilter) return false
      return true
    })

    if (sort === 'worst') {
      list = [...list].sort(
        (a, b) => (unexcused[b.id] ?? 0) - (unexcused[a.id] ?? 0),
      )
    }
    return list
  }, [members, query, duesFilter, roleFilter, sort, unexcused])

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
              {loading
                ? 'Loading…'
                : `${filtered.length} of ${members.length} members`}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Attendance"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'Name (A–Z)' },
              { value: 'worst', label: 'Most absences first' },
            ]}
          />
          <FilterSelect
            label="Dues"
            value={duesFilter}
            onChange={setDuesFilter}
            options={[
              { value: 'all', label: 'All dues' },
              { value: 'paid', label: 'Paid' },
              { value: 'unpaid', label: 'Unpaid' },
            ]}
          />
          <FilterSelect
            label="Role"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'All roles' },
              ...roles.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/50 px-5 py-8 text-center text-sm text-gray-400">
            No members match your filters.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((m) => {
              const absences = unexcused[m.id] ?? 0
              return (
                <li
                  key={m.id}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-maroon/30 hover:shadow-md"
                >
                  {/* Dues toggle (or static indicator without edit_directory) */}
                  <DuesDot
                    paid={m.dues_paid}
                    canEdit={canEditDues}
                    onToggle={() => toggleDues(m)}
                  />

                  <Link
                    to={`/dashboard/members/${m.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4"
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
                            m.position || m.role?.name,
                            gradeLabel(m.grade_level),
                            m.student_id && `ID ${m.student_id}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {absences > 0 && (
                        <span
                          title={`${absences} unexcused absence${absences === 1 ? '' : 's'}`}
                          className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700"
                        >
                          {absences} abs
                        </span>
                      )}
                      <ArrowRight className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-maroon" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Footer />
    </div>
  )
}

// Small filled-circle dues control: green filled = paid, gray hollow = unpaid.
// Editable only with edit_directory; otherwise it's a static indicator.
function DuesDot({ paid, canEdit, onToggle }) {
  const Icon = paid ? CircleCheck : Circle
  const color = paid ? 'text-green-600' : 'text-gray-300'
  const title = paid ? 'Dues paid' : 'Dues unpaid'

  if (!canEdit) {
    return (
      <span title={title} className={`shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title={paid ? 'Dues paid — mark unpaid' : 'Dues unpaid — mark paid'}
      className={`shrink-0 rounded-full transition hover:scale-110 ${color}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
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
