import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronDown, Search, ArrowRight, Loader2, Circle, CircleCheck, Download, X, ShieldCheck } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import MemberPermissions from '../components/MemberPermissions.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { gradeLabel, todayISO } from '../lib/format.js'

// Exportable columns. `value(m, ctx)` returns a stringifiable cell value.
const EXPORT_FIELDS = [
  { key: 'full_name', label: 'Name', value: (m) => m.full_name ?? '' },
  { key: 'student_id', label: 'Student ID', value: (m) => m.student_id ?? '' },
  { key: 'grade_level', label: 'Grade', value: (m) => gradeLabel(m.grade_level) },
  {
    key: 'position',
    label: 'Position',
    value: (m) => m.position || m.role?.name || '',
  },
  { key: 'role', label: 'Role', value: (m) => m.role?.name ?? '' },
  { key: 'shirt_size', label: 'Shirt Size', value: (m) => m.shirt_size ?? '' },
  { key: 'email', label: 'Email', value: (m) => m.email ?? '' },
  {
    key: 'dues_paid',
    label: 'Dues',
    value: (m) => (m.dues_paid ? 'Paid' : 'Unpaid'),
  },
  { key: 'status', label: 'Member Status', value: (m) => m.status ?? '' },
  {
    key: 'unexcused',
    label: 'Unexcused Absences',
    value: (m, ctx) => String(ctx.unexcused[m.id] ?? 0),
  },
]

// Elected-position groups, in display order. A member is an "executive officer"
// by virtue of their elected position group — independent of their role tier
// (an exec officer may sit on the SCI/Admin tier), so this is the axis the
// Position filter keys off, not role_id.
const POSITION_GROUPS = [
  { value: 'exec', label: 'Executive officers' },
  { value: 'senior', label: 'Senior officers' },
  { value: 'junior', label: 'Junior officers' },
  { value: 'sophomore', label: 'Sophomore officers' },
  { value: 'freshman', label: 'Freshman officers' },
  { value: 'custom', label: 'Other officers' },
]

// RFC 4180-ish escaping: wrap in quotes and double any inner quotes when the
// value contains a comma, quote, or newline.
function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildCsv(rows, fields, ctx) {
  const cols = EXPORT_FIELDS.filter((f) => fields.includes(f.key))
  const header = cols.map((c) => csvCell(c.label)).join(',')
  const body = rows
    .map((m) => cols.map((c) => csvCell(c.value(m, ctx))).join(','))
    .join('\n')
  return `${header}\n${body}`
}

function downloadCsv(text, filename) {
  // Prepend a BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function MemberDirectory() {
  return (
    // General Members can view the directory (read-only); the dues toggle inside
    // is separately gated on `edit_directory`. Gating on view_directory — not
    // create_meetings — matches the access-control matrix.
    <RequirePermission permission="view_directory">
      <DirectoryContent />
    </RequirePermission>
  )
}

function DirectoryContent() {
  const { hasPermission } = useAuth()
  const canEditDues = hasPermission('edit_directory')
  // Editing per-member permission overrides is a manage_roles operation (the
  // same gate as changing a member's role); the RLS guard reverts the write
  // otherwise, so don't surface the control without it.
  const canManagePerms = hasPermission('manage_roles')
  const [openPermsId, setOpenPermsId] = useState(null)

  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [unexcused, setUnexcused] = useState({}) // profile_id -> unexcused count
  const [loading, setLoading] = useState(true)

  // Filters
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name') // name | worst (most unexcused first)
  const [duesFilter, setDuesFilter] = useState('all') // all | paid | unpaid
  const [roleFilter, setRoleFilter] = useState('all') // all | <role_id>
  const [positionFilter, setPositionFilter] = useState('all') // all | <group>

  // CSV export
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFields, setExportFields] = useState(() =>
    ['full_name', 'student_id', 'grade_level', 'position', 'dues_paid'],
  )

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: r }, { data: att }] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, full_name, student_id, grade_level, position, role_id, dues_paid, status, email, shirt_size, permission_overrides, role:roles(name, is_admin, permissions), elected_position:elected_positions(group)',
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

  function onSavedPerms(memberId, overrides) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, permission_overrides: overrides } : m,
      ),
    )
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
      if (
        positionFilter !== 'all' &&
        m.elected_position?.group !== positionFilter
      )
        return false
      return true
    })

    if (sort === 'worst') {
      list = [...list].sort(
        (a, b) => (unexcused[b.id] ?? 0) - (unexcused[a.id] ?? 0),
      )
    }
    return list
  }, [members, query, duesFilter, roleFilter, positionFilter, sort, unexcused])

  // Only offer position groups that actually have members, in canonical order.
  const positionOptions = useMemo(() => {
    const present = new Set(
      members.map((m) => m.elected_position?.group).filter(Boolean),
    )
    return POSITION_GROUPS.filter((g) => present.has(g.value))
  }, [members])

  function toggleField(key) {
    setExportFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function handleExport() {
    // Keep CSV columns in the canonical EXPORT_FIELDS order, not click order.
    const ordered = EXPORT_FIELDS.filter((f) =>
      exportFields.includes(f.key),
    ).map((f) => f.key)
    const csv = buildCsv(filtered, ordered, { unexcused })
    downloadCsv(csv, `member-directory-${todayISO()}.csv`)
    setExportOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Member Directory
            </h1>
            <p className="mt-1 text-gray-500">
              {loading
                ? 'Loading…'
                : `${filtered.length} of ${members.length} members`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-maroon shadow-sm transition hover:border-maroon/40 hover:bg-maroon/5"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
            >
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>
        </div>

        {exportOpen && (
          <ExportPanel
            fields={exportFields}
            onToggle={toggleField}
            onExport={handleExport}
            onClose={() => setExportOpen(false)}
            count={filtered.length}
          />
        )}

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
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          {positionOptions.length > 0 && (
            <FilterSelect
              label="Position"
              value={positionFilter}
              onChange={setPositionFilter}
              options={[
                { value: 'all', label: 'All positions' },
                ...positionOptions,
              ]}
            />
          )}
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
              // Overrides only matter for non-admin members (admins always pass).
              const overrideCount = m.role?.is_admin
                ? 0
                : Object.keys(m.permission_overrides ?? {}).length
              const permsOpen = openPermsId === m.id
              return (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-maroon/30 hover:shadow-md"
                >
                  <div className="group flex items-center gap-4 px-5 py-4">
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
                          <p className="truncate font-semibold text-maroon">
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

                    {/* Custom-permissions dropdown (manage_roles only) */}
                    {canManagePerms && !m.role?.is_admin && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenPermsId(permsOpen ? null : m.id)
                        }
                        title="Custom permissions"
                        className={`relative inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                          permsOpen
                            ? 'border-maroon/40 bg-maroon/5 text-maroon'
                            : 'border-gray-300 text-gray-500 hover:border-maroon/40 hover:text-maroon'
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {overrideCount > 0 && (
                          <span className="text-[11px]">{overrideCount}</span>
                        )}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${
                            permsOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {canManagePerms && permsOpen && !m.role?.is_admin && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      <MemberPermissions
                        member={m}
                        onSaved={(ov) => onSavedPerms(m.id, ov)}
                      />
                    </div>
                  )}
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

function ExportPanel({ fields, onToggle, onExport, onClose, count }) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-maroon">
            Export to CSV
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Choose the fields to include. Exports the {count} member
            {count === 1 ? '' : 's'} currently shown.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EXPORT_FIELDS.map((f) => {
          const checked = fields.includes(f.key)
          return (
            <label
              key={f.key}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                checked
                  ? 'border-maroon/40 bg-maroon/5 text-maroon'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(f.key)}
                className="h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30"
              />
              {f.label}
            </label>
          )
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onExport}
          disabled={fields.length === 0 || count === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
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
