import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  UsersRound,
  Crown,
  Plus,
  Trash2,
  Loader2,
  X,
  Pencil,
  FileText,
  Upload,
  Send,
  Search,
  UserPlus,
  Star,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'

export default function Committees() {
  return (
    <RequireAuth>
      <CommitteesContent />
    </RequireAuth>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function CommitteesContent() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('manage_committees')

  const [committees, setCommittees] = useState([])
  const [members, setMembers] = useState([]) // all rows across committees
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    const [{ data: cmts }, { data: mems }] = await Promise.all([
      supabase.from('committees').select('*').order('name', { ascending: true }),
      supabase
        .from('committee_members')
        .select(
          'id, committee_id, member_id, is_chair, joined_at, member:profiles(id, full_name, position, role:roles(name))',
        )
        .order('joined_at', { ascending: true }),
    ])
    setCommittees(cmts ?? [])
    setMembers(mems ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // member rows grouped by committee_id
  const membersByCommittee = useMemo(() => {
    const map = {}
    for (const m of members) (map[m.committee_id] ??= []).push(m)
    return map
  }, [members])

  const selected = committees.find((c) => c.id === selectedId) ?? null

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }

  // ── Detail view ──
  if (selected) {
    return (
      <Shell>
        <CommitteeDetail
          committee={selected}
          members={membersByCommittee[selected.id] ?? []}
          canManage={canManage}
          onBack={() => setSelectedId(null)}
          onChanged={load}
        />
      </Shell>
    )
  }

  // ── List view ──
  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Committees
          </h1>
          <p className="mt-1 text-gray-500">
            Working groups, their members and submitted reports.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>

      {canManage && (
        <div className="mt-6">
          {creating ? (
            <NewCommitteeForm
              onCreated={(id) => {
                setCreating(false)
                load().then(() => setSelectedId(id))
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
            >
              <Plus className="h-4 w-4" /> New Committee
            </button>
          )}
        </div>
      )}

      {committees.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <UsersRound className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No committees yet.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((c) => {
            const list = membersByCommittee[c.id] ?? []
            const chair = list.find((m) => m.is_chair)
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className="group flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-maroon/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-maroon/8 text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
                      <UsersRound className="h-5 w-5" />
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-maroon" />
                  </div>
                  <h2 className="mt-4 font-display text-lg font-bold text-gray-900">
                    {c.name}
                  </h2>
                  {c.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                      {c.description}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {list.length} {list.length === 1 ? 'member' : 'members'}
                    </span>
                    {chair && (
                      <span className="inline-flex items-center gap-1 text-maroon">
                        <Crown className="h-3.5 w-3.5 text-maroon" />
                        {chair.member?.full_name ?? 'Chair'}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
      <Footer />
    </div>
  )
}

// ─────────────────────────── New committee ───────────────────────────
function NewCommitteeForm({ onCreated, onCancel }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setSaving(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('committees')
      .insert({ name: n, description: description.trim(), created_by: profile.id })
      .select('id')
      .single()
    setSaving(false)
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'A committee with that name already exists.'
          : 'Could not create the committee.',
      )
      return
    }
    onCreated(data.id)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <h2 className="font-display text-lg font-bold text-gray-900">
          New Committee
        </h2>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={submit} className="space-y-4 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Committee name"
          autoFocus
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={`${inputClass} resize-y`}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create
        </button>
      </form>
    </section>
  )
}

// ─────────────────────────── Detail ───────────────────────────
function CommitteeDetail({ committee, members, canManage, onBack, onChanged }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
      >
        <ChevronLeft className="h-4 w-4" /> All committees
      </button>

      <CommitteeHeader
        committee={committee}
        canManage={canManage}
        onChanged={onChanged}
        onDeleted={onBack}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <MembersSection
          committee={committee}
          members={members}
          canManage={canManage}
          onChanged={onChanged}
        />
        <ReportsSection committee={committee} canManage={canManage} />
      </div>
    </div>
  )
}

function CommitteeHeader({ committee, canManage, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(committee.name)
  const [description, setDescription] = useState(committee.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setSaving(true)
    setError('')
    const { error: updateError } = await supabase
      .from('committees')
      .update({ name: n, description: description.trim() })
      .eq('id', committee.id)
    setSaving(false)
    if (updateError) {
      setError(
        updateError.code === '23505'
          ? 'A committee with that name already exists.'
          : 'Could not save changes.',
      )
      return
    }
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${committee.name}"? Its members and reports will also be removed. This cannot be undone.`,
      )
    )
      return
    const { error: delError } = await supabase
      .from('committees')
      .delete()
      .eq('id', committee.id)
    if (delError) {
      setError('Could not delete the committee.')
      return
    }
    onChanged()
    onDeleted()
  }

  if (editing) {
    return (
      <form
        onSubmit={save}
        className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Committee name"
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={`${inputClass} resize-y`}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Save'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setName(committee.name)
              setDescription(committee.description)
              setError('')
              setEditing(false)
            }}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold text-gray-900">
          {committee.name}
        </h1>
        {committee.description && (
          <p className="mt-2 max-w-2xl whitespace-pre-line text-gray-600">
            {committee.description}
          </p>
        )}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-maroon/40 hover:text-maroon"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={remove}
            title="Delete committee"
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─────────────────────────── Members ───────────────────────────
function MembersSection({ committee, members, canManage, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function toggleChair(row) {
    setBusyId(row.id)
    setError('')
    // Only one chair per committee — enforced in the UI: demote any existing
    // chair before promoting this one.
    const makeChair = !row.is_chair
    if (makeChair) {
      const current = members.find((m) => m.is_chair && m.id !== row.id)
      if (current) {
        const { error: clearErr } = await supabase
          .from('committee_members')
          .update({ is_chair: false })
          .eq('id', current.id)
        if (clearErr) {
          setBusyId(null)
          setError('Could not update the chair.')
          return
        }
      }
    }
    const { error: updErr } = await supabase
      .from('committee_members')
      .update({ is_chair: makeChair })
      .eq('id', row.id)
    setBusyId(null)
    if (updErr) {
      setError('Could not update the chair.')
      return
    }
    onChanged()
  }

  async function removeMember(row) {
    setBusyId(row.id)
    setError('')
    const { error: delErr } = await supabase
      .from('committee_members')
      .delete()
      .eq('id', row.id)
    setBusyId(null)
    if (delErr) {
      setError('Could not remove the member.')
      return
    }
    onChanged()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-gray-700">
          <Users className="h-4 w-4" /> Members
          <span className="text-gray-400">({members.length})</span>
        </h2>
      </div>

      {canManage && (
        <div className="border-b border-gray-100 p-4">
          <AddMember
            committee={committee}
            existingIds={members.map((m) => m.member_id)}
            onAdded={onChanged}
          />
        </div>
      )}

      {members.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          No members yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-gray-900">
                  <span className="truncate">
                    {row.member?.full_name ?? 'Member'}
                  </span>
                  {row.is_chair && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-maroon">
                      <Crown className="h-3 w-3 text-maroon" /> Chair
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {row.member?.position ||
                    row.member?.role?.name ||
                    'Member'}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleChair(row)}
                    disabled={busyId === row.id}
                    title={row.is_chair ? 'Remove as chair' : 'Make chair'}
                    className={`grid h-8 w-8 place-items-center rounded-lg transition disabled:opacity-50 ${
                      row.is_chair
                        ? 'text-maroon hover:bg-maroon/10'
                        : 'text-gray-300 hover:bg-gray-100 hover:text-maroon'
                    }`}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star
                        className="h-4 w-4"
                        fill={row.is_chair ? 'currentColor' : 'none'}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => removeMember(row)}
                    disabled={busyId === row.id}
                    title="Remove member"
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-5 pb-3 text-xs text-red-600">{error}</p>}
    </section>
  )
}

function AddMember({ committee, existingIds, onAdded }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [error, setError] = useState('')
  const boxRef = useRef(null)

  // Debounced name search against profiles, excluding members already on the
  // committee. Empty query clears results.
  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      return
    }
    setSearching(true)
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position, role:roles(name)')
        .ilike('full_name', `%${term}%`)
        .order('full_name', { ascending: true })
        .limit(8)
      const filtered = (data ?? []).filter(
        (p) => !existingIds.includes(p.id),
      )
      setResults(filtered)
      setSearching(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [query, existingIds])

  // Close the results dropdown on outside click.
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setResults([])
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function add(member) {
    setAddingId(member.id)
    setError('')
    const { error: insertError } = await supabase
      .from('committee_members')
      .insert({ committee_id: committee.id, member_id: member.id })
    setAddingId(null)
    if (insertError) {
      setError('Could not add this member.')
      return
    }
    setQuery('')
    setResults([])
    onAdded()
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a member by name…"
          className={`${inputClass} pl-9`}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {results.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => add(m)}
                disabled={addingId === m.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-maroon/5 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-800">
                    {m.full_name}
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    {m.position || m.role?.name || 'Member'}
                  </span>
                </span>
                {addingId === m.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-maroon" />
                ) : (
                  <UserPlus className="h-4 w-4 shrink-0 text-maroon" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !searching && results.length === 0 && (
        <p className="mt-1 px-1 text-xs text-gray-400">No matching members.</p>
      )}
      {error && <p className="mt-1 px-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─────────────────────────── Reports ───────────────────────────
function ReportsSection({ committee, canManage }) {
  const { profile } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('committee_reports')
      .select(
        'id, committee_id, submitted_by, body, has_file, created_at, submitter:profiles(full_name)',
      )
      .eq('committee_id', committee.id)
      .order('created_at', { ascending: false })
    setReports(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [committee.id])

  // A report can be deleted by its submitter or a committee manager.
  const canDelete = (r) => canManage || r.submitted_by === profile?.id

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-gray-700">
          <FileText className="h-4 w-4" /> Reports
          <span className="text-gray-400">({reports.length})</span>
        </h2>
      </div>

      <div className="border-b border-gray-100 p-4">
        <ReportForm committee={committee} onSubmitted={load} />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-maroon" />
        </div>
      ) : reports.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          No reports submitted yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              canDelete={canDelete(r)}
              onDeleted={load}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ReportRow({ report, canDelete, onDeleted }) {
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function openFile() {
    setOpening(true)
    setError('')
    const tab = window.open('', '_blank')
    const { data, error: fnError } = await supabase.functions.invoke(
      'committee-report-url',
      { body: { report_id: report.id } },
    )
    setOpening(false)
    if (fnError || !data?.url) {
      if (tab) tab.close()
      setError('Could not open this file.')
      return
    }
    if (tab) tab.location = data.url
    else window.open(data.url, '_blank')
  }

  async function remove() {
    if (!window.confirm('Delete this report? This cannot be undone.')) return
    setDeleting(true)
    const { error: delError } = await supabase
      .from('committee_reports')
      .delete()
      .eq('id', report.id)
    setDeleting(false)
    if (delError) {
      setError('Could not delete this report.')
      return
    }
    onDeleted()
  }

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">
            {report.submitter?.full_name ?? 'Unknown'} ·{' '}
            {new Date(report.created_at).toLocaleDateString()}
          </p>
          {report.body && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
              {report.body}
            </p>
          )}
          {report.has_file && (
            <button
              onClick={openFile}
              disabled={opening}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-maroon px-3 py-1.5 text-xs font-semibold text-maroon transition hover:bg-maroon/5 disabled:opacity-60"
            >
              {opening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Open file
            </button>
          )}
        </div>
        {canDelete && (
          <button
            onClick={remove}
            disabled={deleting}
            title="Delete report"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

function ReportForm({ committee, onSubmitted }) {
  const { profile } = useAuth()
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  function reset() {
    setBody('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const text = body.trim()
    // At least one of text / file — matches the DB check constraint.
    if (!text && !file) {
      setError('Add a note or attach a file.')
      return
    }

    setSaving(true)
    let filePath = null
    if (file) {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      filePath = `${profile.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('committee-reports')
        .upload(filePath, file, { upsert: false })
      if (uploadError) {
        setSaving(false)
        setError('File upload failed. Please try again.')
        return
      }
    }

    const { error: insertError } = await supabase
      .from('committee_reports')
      .insert({
        committee_id: committee.id,
        submitted_by: profile.id,
        body: text || null,
        file_url: filePath,
      })

    setSaving(false)
    if (insertError) {
      // Roll back the orphaned upload if the row insert failed.
      if (filePath)
        await supabase.storage.from('committee-reports').remove([filePath])
      setError('Could not submit the report. Please try again.')
      return
    }
    reset()
    onSubmitted()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a report, or attach a file below…"
        rows={2}
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-maroon">
          <Upload className="h-3.5 w-3.5" />
          <span>{file ? file.name : 'Attach file'}</span>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        <button
          type="submit"
          disabled={saving || (!body.trim() && !file)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}
