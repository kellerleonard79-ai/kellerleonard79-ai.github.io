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
  Search,
  UserPlus,
  Star,
  Settings2,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'

// Committees are the org chart — WHO is on what, nothing more. All work (tasks
// and submissions) lives on the Assignments page; this page only links out to
// it. The default view is informational for every member; holders of
// manage_committees can flip into a Manage mode to edit rosters and chairs.
// Auth is guaranteed by the surrounding DashboardLayout shell.
export default function Committees() {
  return <CommitteesContent />
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function CommitteesContent() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('manage_committees')
  const [managing, setManaging] = useState(false)

  const [committees, setCommittees] = useState([])
  const [members, setMembers] = useState([]) // all rows across committees
  const [openTasks, setOpenTasks] = useState({}) // committee_id -> open count
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

  // Open-task counts per committee, for the "N open tasks →" line. RLS scopes
  // the reads: a member counts tasks they're assigned to, an assigning officer
  // counts everything. "Open" = not complete under the task's requires_each
  // rule, mirroring the Assignments page.
  useEffect(() => {
    let active = true
    async function loadCounts() {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, committee_id, requires_each')
        .not('committee_id', 'is', null)
      const list = tasks ?? []
      if (!list.length) {
        if (active) setOpenTasks({})
        return
      }
      const ids = list.map((t) => t.id)
      const [{ data: assignees }, { data: subs }] = await Promise.all([
        supabase.from('task_assignees').select('task_id, member_id').in('task_id', ids),
        supabase.from('task_submissions').select('task_id, member_id').in('task_id', ids),
      ])
      if (!active) return
      const counts = {}
      for (const t of list) {
        const who = (assignees ?? []).filter((a) => a.task_id === t.id)
        const done = new Set(
          (subs ?? []).filter((s) => s.task_id === t.id).map((s) => s.member_id),
        )
        const complete = t.requires_each
          ? who.length > 0 && who.every((a) => done.has(a.member_id))
          : done.size > 0
        if (!complete) counts[t.committee_id] = (counts[t.committee_id] ?? 0) + 1
      }
      setOpenTasks(counts)
    }
    loadCounts()
    return () => {
      active = false
    }
  }, [])

  // member rows grouped by committee_id
  const membersByCommittee = useMemo(() => {
    const map = {}
    for (const m of members) (map[m.committee_id] ??= []).push(m)
    return map
  }, [members])

  // Keep a committee selected whenever possible — default to the first one,
  // and recover gracefully if the selected committee is deleted.
  useEffect(() => {
    if (loading) return
    if (committees.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!committees.some((c) => c.id === selectedId)) {
      setSelectedId(committees[0].id)
    }
  }, [committees, loading, selectedId])

  const selected = committees.find((c) => c.id === selectedId) ?? null
  const editing = canManage && managing

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-maroon">
            Committees
          </h1>
          <p className="mt-1 text-gray-500">
            Working groups, their members and chairs. Tasks live in{' '}
            <Link
              to="/dashboard/assignments"
              className="font-medium text-maroon underline-offset-2 hover:underline"
            >
              Assignments
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={() => setManaging((m) => !m)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                managing
                  ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark'
                  : 'border-gray-300 text-gray-600 hover:border-maroon/40 hover:text-maroon'
              }`}
            >
              <Settings2 className="h-4 w-4" />
              {managing ? 'Done managing' : 'Manage'}
            </button>
          )}
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* ── Left column: committee list ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {editing && (
            <div className="mb-4">
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
                >
                  <Plus className="h-4 w-4" /> New Committee
                </button>
              )}
            </div>
          )}

          {committees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
              <UsersRound className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-400">No committees yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {committees.map((c) => {
                const list = membersByCommittee[c.id] ?? []
                const chair = list.find((m) => m.is_chair)
                const active = c.id === selectedId
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                        active
                          ? 'border-maroon/40 bg-maroon/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-maroon/30 hover:shadow-sm'
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                          active
                            ? 'bg-maroon text-white'
                            : 'bg-maroon/8 text-maroon group-hover:bg-maroon group-hover:text-white'
                        }`}
                      >
                        <UsersRound className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display font-bold text-maroon">
                          {c.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {list.length}
                          </span>
                          {chair && (
                            <span className="inline-flex items-center gap-1 truncate text-maroon">
                              <Crown className="h-3 w-3 shrink-0 text-maroon" />
                              <span className="truncate">
                                {chair.member?.full_name ?? 'Chair'}
                              </span>
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight
                        className={`mt-0.5 h-4 w-4 shrink-0 transition-all ${
                          active
                            ? 'text-maroon'
                            : 'text-gray-300 group-hover:translate-x-0.5 group-hover:text-maroon'
                        }`}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* ── Right column: selected committee ── */}
        <div className="min-w-0">
          {selected ? (
            <CommitteeDetail
              committee={selected}
              members={membersByCommittee[selected.id] ?? []}
              openCount={openTasks[selected.id] ?? 0}
              editing={editing}
              onChanged={load}
            />
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-gray-300 bg-white py-24 text-center">
              <div>
                <UsersRound className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm text-gray-400">
                  Select a committee to view its members.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
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
        <h2 className="font-display text-lg font-bold text-maroon">
          New Committee
        </h2>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
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
function CommitteeDetail({ committee, members, openCount, editing, onChanged }) {
  return (
    <div>
      <CommitteeHeader
        committee={committee}
        openCount={openCount}
        editing={editing}
        onChanged={onChanged}
      />

      <div className="mt-6">
        <MembersSection
          committee={committee}
          members={members}
          editing={editing}
          onChanged={onChanged}
        />
      </div>
    </div>
  )
}

function CommitteeHeader({ committee, openCount, editing, onChanged }) {
  const [editingHeader, setEditingHeader] = useState(false)
  const [name, setName] = useState(committee.name)
  const [description, setDescription] = useState(committee.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Leaving Manage mode also closes an in-progress header edit.
  useEffect(() => {
    if (!editing) setEditingHeader(false)
  }, [editing])

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
    setEditingHeader(false)
    onChanged()
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${committee.name}"? Its roster will be removed; already-assigned tasks stay with their assignees in Assignments. This cannot be undone.`,
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
  }

  if (editingHeader) {
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setName(committee.name)
              setDescription(committee.description)
              setError('')
              setEditingHeader(false)
            }}
            className="text-sm font-medium text-gray-500 hover:text-maroon"
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
        <h1 className="font-display text-3xl font-bold text-maroon">
          {committee.name}
        </h1>
        {committee.description && (
          <p className="mt-2 max-w-2xl whitespace-pre-line text-gray-600">
            {committee.description}
          </p>
        )}
        {/* The one line linking out to work — no task list, no submission form
            here. openCount reflects what the viewer can see via RLS. */}
        {openCount > 0 && (
          <Link
            to={`/dashboard/assignments?committee=${committee.id}`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-maroon underline-offset-2 hover:underline"
          >
            <ClipboardList className="h-4 w-4" />
            {openCount} open task{openCount === 1 ? '' : 's'}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {editing && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditingHeader(true)}
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
function MembersSection({ committee, members, editing, onChanged }) {
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
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-maroon">
          <Users className="h-4 w-4" /> Members
          <span className="text-gray-400">({members.length})</span>
        </h2>
      </div>

      {editing && (
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
                <p className="flex items-center gap-1.5 font-medium text-maroon">
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
                  {row.member?.position || row.member?.role?.name || 'Member'}
                </p>
              </div>
              {editing && (
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
      const filtered = (data ?? []).filter((p) => !existingIds.includes(p.id))
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
                  <span className="block truncate font-medium text-maroon">
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
