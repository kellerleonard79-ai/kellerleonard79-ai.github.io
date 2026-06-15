import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Vote,
  UserPlus,
  Loader2,
  Check,
  X,
  Plus,
  Trophy,
  RotateCcw,
  Lock,
  Unlock,
  Users,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatTime } from '../lib/format.js'

export default function Elections() {
  return (
    <RequirePermission permission="view_elections">
      <ElectionsContent />
    </RequirePermission>
  )
}

// Statuses that count as "live" candidates shown in the scoring grid. Pending
// candidates live in the per-cycle applications section; rejected ones are hidden.
const ACTIVE_STATUSES = ['interviewing', 'approved', 'winner', 'assigned']

// composite = interview_score × interview_weight + vote_percentage × election_weight
// Returns null when neither score has been entered yet.
function computeComposite(cand, cycle) {
  const iw = cycle?.interview_weight ?? 0.5
  const ew = cycle?.election_weight ?? 0.5
  if (cand.interview_score == null && cand.vote_percentage == null) return null
  return (cand.interview_score ?? 0) * iw + (cand.vote_percentage ?? 0) * ew
}

const pct = (n) =>
  n == null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)}%`

function ElectionsContent() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('manage_elections')

  const [cycles, setCycles] = useState([])
  const [candidates, setCandidates] = useState([])
  const [applications, setApplications] = useState([])
  const [positions, setPositions] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCycleId, setSelectedCycleId] = useState(null)

  const load = useCallback(async () => {
    const [
      { data: cyc },
      { data: cand },
      { data: apps },
      { data: pos },
      { data: rls },
    ] = await Promise.all([
      supabase
        .from('election_cycles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('election_candidates')
        .select(
          '*, member:profiles(full_name, student_id), position:elected_positions(title, "group", "order")',
        )
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name, student_id, role_id, grade_level')
        .eq('status', 'pending')
        .eq('is_candidate_application', true)
        .order('full_name', { ascending: true }),
      supabase
        .from('elected_positions')
        .select('id, title, "group", "order", show_in_elections')
        .order('group', { ascending: true })
        .order('order', { ascending: true }),
      supabase
        .from('roles')
        .select('id, name, permissions, is_admin, order')
        .order('order', { ascending: true }),
    ])
    setCycles(cyc ?? [])
    setCandidates(cand ?? [])
    setApplications(apps ?? [])
    setPositions(pos ?? [])
    setRoles(rls ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Elections
            </h1>
            <p className="mt-1 text-gray-500">
              {canManage
                ? 'Manage cycles, score candidates and assign positions.'
                : 'Election cycles, candidates and results.'}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* The Join SGA applications queue sits above the cycles, always. */}
            <ApplicationsQueue
              applications={applications}
              cycles={cycles}
              positions={positions}
              roles={roles}
              canManage={canManage}
              onChanged={load}
            />

            {selectedCycle ? (
              <CycleDetail
                cycle={selectedCycle}
                candidates={candidates.filter(
                  (c) => c.cycle_id === selectedCycle.id,
                )}
                positions={positions}
                roles={roles}
                canManage={canManage}
                onBack={() => setSelectedCycleId(null)}
                onChanged={load}
              />
            ) : (
              <CyclesList
                cycles={cycles}
                candidates={candidates}
                canManage={canManage}
                onOpen={setSelectedCycleId}
                onChanged={load}
              />
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

// Shared card chrome (matches SecurityClearance / EditSite).
function Section({ icon: Icon, title, desc, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-maroon">
            {title}
          </h2>
          {desc && <p className="text-sm text-gray-500">{desc}</p>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    interviewing: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    rejected: 'bg-gray-100 text-gray-500 border-gray-200',
    winner: 'bg-green-50 text-green-700 border-green-200',
    assigned: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
      }`}
    >
      {status}
    </span>
  )
}

// ───────────────────────── Join SGA applications queue ─────────────────────────
function ApplicationsQueue({
  applications,
  cycles,
  positions,
  roles,
  canManage,
  onChanged,
}) {
  if (applications.length === 0 && !canManage) return null

  return (
    <Section
      icon={UserPlus}
      title="Join SGA Applications"
      desc="New signups who indicated they're running for a position."
    >
      {applications.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No pending candidate applications.
        </p>
      ) : (
        <ul className="space-y-3">
          {applications.map((a) => (
            <ApplicationRow
              key={a.id}
              application={a}
              cycles={cycles}
              positions={positions}
              roles={roles}
              canManage={canManage}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </Section>
  )
}

function defaultMemberRole(roles) {
  return (
    roles.find((r) => r.name === 'General Member') ??
    roles.find((r) => !r.is_admin) ??
    null
  )
}

function clearanceForRole(role) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

function ApplicationRow({
  application: a,
  cycles,
  positions,
  roles,
  canManage,
  onChanged,
}) {
  const [busy, setBusy] = useState(false)
  const [showCandidate, setShowCandidate] = useState(false)
  const [positionId, setPositionId] = useState('')
  const [cycleId, setCycleId] = useState('')

  const electablePositions = positions.filter((p) => p.show_in_elections)
  const memberRole = defaultMemberRole(roles)

  // Approve as a plain general member (no candidacy).
  async function approveMember() {
    setBusy(true)
    await supabase
      .from('profiles')
      .update({
        status: 'active',
        is_candidate_application: false,
        role_id: memberRole?.id ?? a.role_id,
        clearance_level: clearanceForRole(memberRole),
      })
      .eq('id', a.id)
    setBusy(false)
    onChanged()
  }

  // Approve and create a candidate row for the chosen position/cycle.
  async function approveCandidate() {
    if (!positionId) return
    setBusy(true)
    await supabase
      .from('profiles')
      .update({
        status: 'active',
        is_candidate_application: false,
        role_id: memberRole?.id ?? a.role_id,
        clearance_level: clearanceForRole(memberRole),
      })
      .eq('id', a.id)
    await supabase.from('election_candidates').insert({
      member_id: a.id,
      position_id: positionId,
      cycle_id: cycleId || null,
      status: 'pending',
    })
    setBusy(false)
    onChanged()
  }

  async function reject() {
    if (
      !window.confirm(
        `Reject and permanently delete ${
          a.full_name ?? 'this applicant'
        }'s account? This cannot be undone.`,
      )
    )
      return
    setBusy(true)
    const { error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: a.id },
    })
    if (error) {
      setBusy(false)
      window.alert(`Reject failed: ${error.message}`)
      return
    }
    await supabase.from('profiles').delete().eq('id', a.id)
    setBusy(false)
    onChanged()
  }

  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-maroon">
            {a.full_name ?? 'Applicant'}
          </p>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            {a.student_id ? `ID ${a.student_id}` : 'No student ID'}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={approveMember}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-maroon/30 px-3 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Approve as member
            </button>
            <button
              onClick={() => setShowCandidate((s) => !s)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
            >
              <Vote className="h-4 w-4" />
              Approve as candidate
            </button>
            <button
              onClick={reject}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}
      </div>

      {canManage && showCandidate && (
        <div className="mt-4 grid gap-3 border-t border-amber-200 pt-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Position
            </span>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select position…</option>
              {electablePositions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Cycle
            </span>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className={selectClass}
            >
              <option value="">Mid-year fill (no cycle)</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={approveCandidate}
              disabled={busy || !positionId}
              className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-lg bg-maroon px-4 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Add candidate
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

// ───────────────────────── Cycles list ─────────────────────────
function CyclesList({ cycles, candidates, canManage, onOpen, onChanged }) {
  const [creating, setCreating] = useState(false)

  const countFor = (cycleId) =>
    candidates.filter((c) => c.cycle_id === cycleId).length

  return (
    <Section
      icon={Vote}
      title="Election Cycles"
      desc="Each cycle groups candidates and sets the score weighting."
      action={
        canManage && !creating ? (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            <Plus className="h-4 w-4" /> New cycle
          </button>
        ) : null
      }
    >
      {creating && (
        <CreateCycleForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            onChanged()
          }}
        />
      )}

      {cycles.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No election cycles yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onOpen(c.id)}
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition hover:border-maroon/30 hover:bg-maroon/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-maroon">
                      {c.name}
                    </p>
                    {c.is_open ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        <Unlock className="h-3 w-3" /> Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {countFor(c.id)} candidate
                    {countFor(c.id) === 1 ? '' : 's'} · Interview{' '}
                    {Math.round(c.interview_weight * 100)}% / Election{' '}
                    {Math.round(c.election_weight * 100)}%
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function CreateCycleForm({ onCancel, onCreated }) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [openDate, setOpenDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [interview, setInterview] = useState(50) // percent
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    const { error } = await supabase.from('election_cycles').insert({
      name: name.trim(),
      open_date: openDate ? new Date(openDate).toISOString() : null,
      close_date: closeDate ? new Date(closeDate).toISOString() : null,
      interview_weight: interview / 100,
      election_weight: (100 - interview) / 100,
      created_by: profile?.id ?? null,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onCreated()
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 rounded-xl border border-maroon/20 bg-maroon/[0.03] p-4"
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-gray-600">
          Cycle name
        </span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring 2026"
          className={inputClass}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Opens (optional)
          </span>
          <input
            type="datetime-local"
            value={openDate}
            onChange={(e) => setOpenDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Closes (optional)
          </span>
          <input
            type="datetime-local"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Interview weight {interview}%</span>
          <span>Election weight {100 - interview}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={interview}
          onChange={(e) => setInterview(Number(e.target.value))}
          className="mt-2 w-full accent-maroon"
        />
        <p className="mt-1 text-[11px] text-gray-400">
          Weights always sum to 100%.
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 transition hover:text-maroon"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create cycle
        </button>
      </div>
    </form>
  )
}

// ───────────────────────── Cycle detail ─────────────────────────
function CycleDetail({
  cycle,
  candidates,
  positions,
  roles,
  canManage,
  onBack,
  onChanged,
}) {
  const [togglingOpen, setTogglingOpen] = useState(false)

  const pending = candidates.filter((c) => c.status === 'pending')
  const active = candidates.filter((c) => ACTIVE_STATUSES.includes(c.status))

  // Group active candidates by position, preserving position display order.
  const groups = useMemo(() => {
    const byPos = new Map()
    for (const c of active) {
      if (!byPos.has(c.position_id)) byPos.set(c.position_id, [])
      byPos.get(c.position_id).push(c)
    }
    return [...byPos.entries()]
      .map(([positionId, list]) => ({
        positionId,
        title: list[0].position?.title ?? 'Position',
        candidates: list,
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [active])

  async function toggleOpen() {
    setTogglingOpen(true)
    await supabase
      .from('election_cycles')
      .update({ is_open: !cycle.is_open })
      .eq('id', cycle.id)
    setTogglingOpen(false)
    onChanged()
  }

  async function setStatus(candidate, status) {
    await supabase
      .from('election_candidates')
      .update({ status })
      .eq('id', candidate.id)
    onChanged()
  }

  return (
    <Section
      icon={Vote}
      title={cycle.name}
      desc={`Interview ${Math.round(
        cycle.interview_weight * 100,
      )}% / Election ${Math.round(cycle.election_weight * 100)}%`}
      action={
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> All cycles
        </button>
      }
    >
      {/* Header strip: open/closed + dates */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              cycle.is_open
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {cycle.is_open ? (
              <Unlock className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {cycle.is_open ? 'Open' : 'Closed'}
          </span>
          <span className="ml-3">
            {cycle.open_date
              ? `${new Date(cycle.open_date).toLocaleDateString()} ${formatTime(
                  cycle.open_date,
                )}`
              : 'No open date'}
            {' → '}
            {cycle.close_date
              ? `${new Date(
                  cycle.close_date,
                ).toLocaleDateString()} ${formatTime(cycle.close_date)}`
              : 'No close date'}
          </span>
        </div>
        {canManage && (
          <button
            onClick={toggleOpen}
            disabled={togglingOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-maroon transition hover:bg-white disabled:opacity-60"
          >
            {togglingOpen ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : cycle.is_open ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            {cycle.is_open ? 'Close cycle' : 'Open cycle'}
          </button>
        )}
      </div>

      {/* Pending applications inside the cycle */}
      <div className="mb-8">
        <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-maroon">
          <Users className="h-4 w-4 text-maroon" /> Pending Applications
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
            No pending applications in this cycle.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-maroon">
                    {c.member?.full_name ?? 'Member'}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {c.position?.title ?? 'Position'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setStatus(c, 'interviewing')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
                    >
                      <Check className="h-4 w-4" /> Interview
                    </button>
                    <button
                      onClick={() => setStatus(c, 'rejected')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Candidates grouped by position */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-maroon">
          <Trophy className="h-4 w-4 text-maroon" /> Candidates
        </h3>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
            No candidates yet. Move pending applications to interviewing to begin
            scoring.
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <PositionGroup
                key={g.positionId}
                group={g}
                cycle={cycle}
                roles={roles}
                canManage={canManage}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

function PositionGroup({ group, cycle, roles, canManage, onChanged }) {
  const [upgradeRoleId, setUpgradeRoleId] = useState('')
  const [busy, setBusy] = useState(false)

  const hasWinner = group.candidates.some(
    (c) => c.status === 'winner' || c.status === 'assigned',
  )

  // Highest composite among scored candidates → the confirm-winner target.
  const topId = useMemo(() => {
    let top = null
    for (const c of group.candidates) {
      const score = computeComposite(c, cycle)
      if (score == null) continue
      if (top == null || score > top.score) top = { id: c.id, score }
    }
    return top?.id ?? null
  }, [group.candidates, cycle])

  async function confirmWinner(candidate) {
    if (
      !window.confirm(
        `Confirm ${
          candidate.member?.full_name ?? 'this candidate'
        } as the winner for ${group.title}? Other candidates will be rejected.`,
      )
    )
      return
    setBusy(true)
    const { error } = await supabase.rpc('confirm_election_winner', {
      p_candidate_id: candidate.id,
      p_upgrade_role_id: upgradeRoleId || null,
    })
    setBusy(false)
    if (error) {
      window.alert(`Confirm failed: ${error.message}`)
      return
    }
    onChanged()
  }

  async function revoke(candidate) {
    if (
      !window.confirm(
        `Revoke ${group.title} from ${
          candidate.member?.full_name ?? 'this member'
        }? Their candidate record is kept.`,
      )
    )
      return
    setBusy(true)
    const { error } = await supabase.rpc('revoke_election_winner', {
      p_candidate_id: candidate.id,
    })
    setBusy(false)
    if (error) {
      window.alert(`Revoke failed: ${error.message}`)
      return
    }
    onChanged()
  }

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h4 className="font-semibold text-maroon">{group.title}</h4>
        {canManage && !hasWinner && group.candidates.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={upgradeRoleId}
              onChange={(e) => setUpgradeRoleId(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-maroon outline-none focus:border-maroon"
              title="Optionally upgrade the winner's role"
            >
              <option value="">Keep current role</option>
              {roles
                .filter((r) => !r.is_admin)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Upgrade to {r.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
      <ul className="divide-y divide-gray-100">
        {group.candidates.map((c) => (
          <CandidateRow
            key={c.id}
            candidate={c}
            cycle={cycle}
            canManage={canManage}
            isTop={c.id === topId}
            hasWinner={hasWinner}
            busy={busy}
            onConfirm={() => confirmWinner(c)}
            onRevoke={() => revoke(c)}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </div>
  )
}

function CandidateRow({
  candidate,
  cycle,
  canManage,
  isTop,
  hasWinner,
  busy,
  onConfirm,
  onRevoke,
  onChanged,
}) {
  // Local editable copy; saved to the DB on blur along with the recomputed
  // composite score (weights live on the cycle).
  const [draft, setDraft] = useState({
    interview_score: candidate.interview_score ?? '',
    interview_notes: candidate.interview_notes ?? '',
    vote_count: candidate.vote_count ?? '',
    vote_percentage: candidate.vote_percentage ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Keep the draft in sync if the row is reloaded (e.g. after a status change).
  useEffect(() => {
    setDraft({
      interview_score: candidate.interview_score ?? '',
      interview_notes: candidate.interview_notes ?? '',
      vote_count: candidate.vote_count ?? '',
      vote_percentage: candidate.vote_percentage ?? '',
    })
  }, [
    candidate.interview_score,
    candidate.interview_notes,
    candidate.vote_count,
    candidate.vote_percentage,
  ])

  const liveComposite = computeComposite(
    {
      interview_score:
        draft.interview_score === '' ? null : Number(draft.interview_score),
      vote_percentage:
        draft.vote_percentage === '' ? null : Number(draft.vote_percentage),
    },
    cycle,
  )

  async function saveField(field) {
    const numericFields = ['interview_score', 'vote_count', 'vote_percentage']
    let value = draft[field]
    if (numericFields.includes(field)) {
      value = value === '' ? null : Number(value)
    }
    // No change → skip the write.
    if ((candidate[field] ?? (field === 'interview_notes' ? '' : null)) === value)
      return

    setSaving(true)
    await supabase
      .from('election_candidates')
      .update({ [field]: value, composite_score: liveComposite })
      .eq('id', candidate.id)
    setSaving(false)
    onChanged()
  }

  const isWinner =
    candidate.status === 'winner' || candidate.status === 'assigned'
  const set = (field) => (e) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }))

  return (
    <li className={`p-4 ${isTop && !hasWinner ? 'bg-maroon/[0.06]' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-maroon">
            {candidate.member?.full_name ?? 'Member'}
          </p>
          <StatusBadge status={candidate.status} />
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-maroon" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Composite{' '}
            <span className="font-bold text-maroon">{pct(liveComposite)}</span>
          </span>
          {canManage && !hasWinner && isTop && (
            <button
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              <Trophy className="h-4 w-4" /> Confirm Winner
            </button>
          )}
          {canManage && isWinner && (
            <button
              onClick={onRevoke}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-maroon transition hover:bg-gray-50 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" /> Revoke
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Interview score (0–100%)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            disabled={!canManage}
            value={draft.interview_score}
            onChange={set('interview_score')}
            onBlur={() => saveField('interview_score')}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Vote count
          </span>
          <input
            type="number"
            min={0}
            disabled={!canManage}
            value={draft.vote_count}
            onChange={set('vote_count')}
            onBlur={() => saveField('vote_count')}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            Vote percentage (0–100%)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            disabled={!canManage}
            value={draft.vote_percentage}
            onChange={set('vote_percentage')}
            onBlur={() => saveField('vote_percentage')}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-gray-600">
          Interview notes
        </span>
        <textarea
          rows={2}
          disabled={!canManage}
          value={draft.interview_notes}
          onChange={set('interview_notes')}
          onBlur={() => saveField('interview_notes')}
          className={`${inputClass} resize-y`}
          placeholder={canManage ? 'Notes from the interview…' : ''}
        />
      </label>
    </li>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

const selectClass = inputClass
