import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
  AlertTriangle,
  FileText,
  Upload,
  Send,
  Search,
  Settings2,
  UsersRound,
  UserCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, todayISO } from '../lib/format.js'

// Assignments = WORK. Every task and every submission in the app lives here —
// no other page accepts a submission. An assignment is a task plus an explicit
// set of assignees (task_assignees), resolved when the task is created; the
// committee/group pickers in Manage are just shortcuts for populating that set.
//
// Default view (every member): their own work — individual/group tasks under
// "Assigned to me", committee-context tasks under "My committees" — with inline
// submission. Manage view (assign_tasks permission): create tasks, review all
// tasks and submissions, adjust assignee sets.
export default function Assignments() {
  const { hasPermission, profile } = useAuth()
  const canAssign = hasPermission('assign_tasks')
  // The Committees page deep-links here with ?committee=<id>. For an assigning
  // officer that means "show me that committee's tasks", which lives in Manage;
  // for everyone else it filters their own work (handled in MyWork).
  const [searchParams] = useSearchParams()
  const linkedCommittee = searchParams.get('committee')
  const [managing, setManaging] = useState(canAssign && Boolean(linkedCommittee))

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-maroon">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {managing
              ? 'Assign work and review submissions.'
              : 'Your tasks — submit your work here.'}
          </p>
        </div>
        {canAssign && (
          <button
            onClick={() => setManaging((m) => !m)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              managing
                ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark'
                : 'border-gray-300 text-gray-600 hover:border-maroon/40 hover:text-maroon'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            {managing ? 'Back to my work' : 'Manage'}
          </button>
        )}
      </header>

      {managing && canAssign ? (
        <ManageView profile={profile} initialCommittee={linkedCommittee} />
      ) : (
        <MyWork profile={profile} />
      )}
    </div>
  )
}

/* ═══════════════════════════ member view ═══════════════════════════ */

function MyWork({ profile }) {
  const [tasks, setTasks] = useState([])
  const [assigneesByTask, setAssigneesByTask] = useState({})
  const [subsByTask, setSubsByTask] = useState({})
  const [loading, setLoading] = useState(true)
  // ?committee=<id> deep links here from the Committees page's "open tasks"
  // line — it filters the "My committees" half to that one committee.
  const [searchParams, setSearchParams] = useSearchParams()
  const committeeFilter = searchParams.get('committee')

  const load = useCallback(async () => {
    const { data: mine } = await supabase
      .from('task_assignees')
      .select('task_id')
      .eq('member_id', profile.id)
    const ids = (mine ?? []).map((r) => r.task_id)
    if (!ids.length) {
      setTasks([])
      setLoading(false)
      return
    }
    const [{ data: taskRows }, { data: assignees }, { data: subs }] =
      await Promise.all([
        supabase
          .from('tasks')
          .select(
            'id, title, description, due_date, requires_each, committee_id, committee:committees(name), created_at',
          )
          .in('id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_assignees')
          .select('task_id, member_id, member:profiles(full_name)')
          .in('task_id', ids),
        supabase
          .from('task_submissions')
          .select(
            'id, task_id, member_id, body, has_file, created_at, submitter:profiles(full_name)',
          )
          .in('task_id', ids)
          .order('created_at', { ascending: false }),
      ])
    setTasks(taskRows ?? [])
    setAssigneesByTask(groupBy(assignees ?? [], 'task_id'))
    setSubsByTask(groupBy(subs ?? [], 'task_id'))
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) =>
        (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'),
      ),
    [tasks],
  )
  // A class-wide or individual task is personal work from the member's point
  // of view; committee-context tasks group under their committee.
  const personal = sorted.filter((t) => !t.committee_id)
  const committeeGroups = useMemo(() => {
    const groups = new Map()
    for (const t of sorted) {
      if (!t.committee_id) continue
      if (committeeFilter && t.committee_id !== committeeFilter) continue
      const key = t.committee_id
      if (!groups.has(key))
        groups.set(key, { name: t.committee?.name ?? 'Committee', tasks: [] })
      groups.get(key).tasks.push(t)
    }
    return [...groups.values()]
  }, [sorted, committeeFilter])

  if (loading) return <Loading />

  if (tasks.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-400">
          Nothing is assigned to you right now.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {committeeFilter && (
        <div className="flex items-center justify-between rounded-xl border border-maroon/20 bg-maroon/5 px-4 py-2.5 text-sm text-maroon">
          <span>Showing tasks for one committee.</span>
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Show all
          </button>
        </div>
      )}

      {!committeeFilter && (
        <section>
          <SectionHeading icon={UserCircle}>Assigned to me</SectionHeading>
          {personal.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">
              No individual tasks right now.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {personal.map((t) => (
                <MyTaskCard
                  key={t.id}
                  task={t}
                  assignees={assigneesByTask[t.id] ?? []}
                  submissions={subsByTask[t.id] ?? []}
                  profile={profile}
                  onChanged={load}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {(committeeFilter || committeeGroups.length > 0) && (
        <section>
          <SectionHeading icon={UsersRound}>My committees</SectionHeading>
          {committeeGroups.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">
              No tasks assigned to you in this committee.
            </p>
          ) : (
            <div className="mt-3 space-y-6">
              {committeeGroups.map((g) => (
                <div key={g.name}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                    {g.name}
                  </h3>
                  <ul className="space-y-3">
                    {g.tasks.map((t) => (
                      <MyTaskCard
                        key={t.id}
                        task={t}
                        assignees={assigneesByTask[t.id] ?? []}
                        submissions={subsByTask[t.id] ?? []}
                        profile={profile}
                        onChanged={load}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// One task from the assignee's perspective: status, teammates' submissions
// (crucial on any-one tasks so three people don't do the same job), and the
// inline submit form — the app's single submission mechanism.
function MyTaskCard({ task, assignees, submissions, profile, onChanged }) {
  const { complete, overdue, submittedCount } = taskProgress(task, assignees, submissions)
  const mine = submissions.some((s) => s.member_id === profile.id)
  const teammateDid = !task.requires_each && !mine && submissions.length > 0
  const [showForm, setShowForm] = useState(false)
  // The form is open by default while the member still owes work.
  const formOpen = showForm || (!mine && !complete)

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-maroon">{task.title}</p>
          {task.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {complete ? (
            <StatusChip tone="green" icon={CheckCircle2} label="Complete" />
          ) : (
            <DueBadge due={task.due_date} overdue={overdue} />
          )}
        </div>
      </div>

      {/* Group expectation, so members know whether "someone did it" is enough. */}
      <p className="mt-2 text-xs text-gray-400">
        {task.requires_each
          ? `Everyone must submit — ${submittedCount} of ${assignees.length} done.`
          : 'Any one person completes this for the group.'}
      </p>

      {teammateDid && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Already handled — {submissions[0].submitter?.full_name ?? 'a teammate'}{' '}
            submitted on {new Date(submissions[0].created_at).toLocaleDateString()}.
          </span>
        </div>
      )}

      {submissions.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-maroon/15 pl-3">
          {submissions.map((s) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              canDelete={s.member_id === profile.id}
              onDeleted={onChanged}
            />
          ))}
        </ul>
      )}

      <div className="mt-3">
        {formOpen ? (
          <SubmitForm task={task} onSubmitted={onChanged} />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-maroon underline-offset-2 hover:underline"
          >
            {mine ? 'Add another submission' : 'Submit anyway'}
          </button>
        )}
      </div>
    </li>
  )
}

/* ═══════════════════════════ manage view ═══════════════════════════ */

function ManageView({ profile, initialCommittee }) {
  const [members, setMembers] = useState([])
  const [committees, setCommittees] = useState([])
  const [roster, setRoster] = useState([]) // committee_members rows
  const [tasks, setTasks] = useState([])
  const [assigneesByTask, setAssigneesByTask] = useState({})
  const [subsByTask, setSubsByTask] = useState({})
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    const { data: taskRows } = await supabase
      .from('tasks')
      .select(
        'id, title, description, due_date, requires_each, committee_id, committee:committees(name), created_at',
      )
      .order('created_at', { ascending: false })
    const list = taskRows ?? []
    setTasks(list)
    const ids = list.map((t) => t.id)
    if (!ids.length) {
      setAssigneesByTask({})
      setSubsByTask({})
      return
    }
    const [{ data: assignees }, { data: subs }] = await Promise.all([
      supabase
        .from('task_assignees')
        .select('task_id, member_id, member:profiles(full_name)')
        .in('task_id', ids),
      supabase
        .from('task_submissions')
        .select(
          'id, task_id, member_id, body, has_file, created_at, submitter:profiles(full_name)',
        )
        .in('task_id', ids)
        .order('created_at', { ascending: false }),
    ])
    setAssigneesByTask(groupBy(assignees ?? [], 'task_id'))
    setSubsByTask(groupBy(subs ?? [], 'task_id'))
  }, [])

  useEffect(() => {
    Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, grade_level, status, role:roles(name), elected_position:elected_positions(group)',
        )
        .order('full_name', { ascending: true }),
      supabase.from('committees').select('id, name').order('name', { ascending: true }),
      supabase.from('committee_members').select('committee_id, member_id'),
      loadTasks(),
    ]).then(([{ data: mems }, { data: comms }, { data: cm }]) => {
      setMembers((mems ?? []).filter((m) => m.full_name))
      setCommittees(comms ?? [])
      setRoster(cm ?? [])
      setLoading(false)
    })
  }, [loadTasks])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <CreateTaskCard
        profile={profile}
        members={members}
        committees={committees}
        roster={roster}
        onCreated={loadTasks}
      />
      <AllTasksCard
        tasks={tasks}
        assigneesByTask={assigneesByTask}
        subsByTask={subsByTask}
        members={members}
        committees={committees}
        initialCommittee={initialCommittee}
        onChanged={loadTasks}
      />
    </div>
  )
}

/* ─────────────────────────── create task ─────────────────────────── */

// Grade chips vs position-group chips share words like "Senior" — the labels
// below keep them unmistakable: "Seniors (12th grade)" is everyone in grade 12
// (could be forty people), "Senior class officers" is the handful holding a
// senior-group elected position. Never label either one just "Senior".
const GRADE_CHIP_LABELS = {
  12: 'Seniors (12th grade)',
  11: 'Juniors (11th grade)',
  10: 'Sophomores (10th grade)',
  9: 'Freshmen (9th grade)',
}
const POSITION_GROUP_CHIP_LABELS = {
  exec: 'Executive officers',
  senior: 'Senior class officers',
  junior: 'Junior class officers',
  sophomore: 'Sophomore class officers',
  freshman: 'Freshman class officers',
}

function CreateTaskCard({ profile, members, committees, roster, onCreated }) {
  const [mode, setMode] = useState('committee') // 'committee' | 'people'
  const [committeeId, setCommitteeId] = useState('')
  const [selected, setSelected] = useState([]) // member ids, insertion-ordered
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hasDue, setHasDue] = useState(false)
  const [dueDate, setDueDate] = useState(todayISO())
  const [requiresEach, setRequiresEach] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  )
  const rosterByCommittee = useMemo(() => {
    const map = {}
    for (const r of roster) (map[r.committee_id] ??= []).push(r.member_id)
    return map
  }, [roster])

  // Quick-add group chips, derived from data already on profiles. Each chip
  // dumps its members into the pill list; pills stay individually removable
  // (that deselection is the whole reason the set is explicit).
  const chips = useMemo(() => {
    const active = members.filter((m) => m.status === 'active')
    const list = [{ label: 'All members', ids: active.map((m) => m.id) }]
    for (const grade of [12, 11, 10, 9]) {
      const ids = active.filter((m) => m.grade_level === grade).map((m) => m.id)
      if (ids.length) list.push({ label: GRADE_CHIP_LABELS[grade], ids })
    }
    for (const [key, label] of Object.entries(POSITION_GROUP_CHIP_LABELS)) {
      const ids = active
        .filter((m) => m.elected_position?.group === key)
        .map((m) => m.id)
      if (ids.length) list.push({ label, ids })
    }
    const byRole = {}
    for (const m of active)
      if (m.role?.name) (byRole[m.role.name] ??= []).push(m.id)
    for (const [name, ids] of Object.entries(byRole))
      list.push({ label: `${name} (tier)`, ids })
    for (const c of committees) {
      const ids = (rosterByCommittee[c.id] ?? []).filter((id) => memberById[id])
      if (ids.length) list.push({ label: c.name, ids })
    }
    return list
  }, [members, committees, rosterByCommittee, memberById])

  function addIds(ids) {
    setSelected((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))])
  }

  function pickCommittee(id) {
    setCommitteeId(id)
    // The roster is only the starting set — a snapshot the officer can trim.
    setSelected(rosterByCommittee[id] ?? [])
  }

  function switchMode(next) {
    if (next === mode) return
    setMode(next)
    setCommitteeId('')
    setSelected([])
  }

  async function submit(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t || selected.length === 0) return
    if (hasDue && !dueDate) {
      setError('Choose a due date, or turn off "Set a due date".')
      return
    }
    setSaving(true)
    setError('')
    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: t,
        description: description.trim(),
        due_date: hasDue ? dueDate : null,
        requires_each: requiresEach,
        // Context for grouping only — the assignee rows below are what assign.
        committee_id: mode === 'committee' ? committeeId || null : null,
        created_by: profile.id,
      })
      .select('id')
      .single()
    if (insertError) {
      setSaving(false)
      setError('Could not create the task.')
      return
    }
    const { error: assignError } = await supabase
      .from('task_assignees')
      .insert(selected.map((member_id) => ({ task_id: task.id, member_id })))
    if (assignError) {
      // Don't leave an unassigned husk behind.
      await supabase.from('tasks').delete().eq('id', task.id)
      setSaving(false)
      setError('Could not assign the task. Please try again.')
      return
    }
    setSaving(false)
    setTitle('')
    setDescription('')
    setHasDue(false)
    setDueDate(todayISO())
    setRequiresEach(false)
    setSelected(mode === 'committee' && committeeId ? rosterByCommittee[committeeId] ?? [] : [])
    onCreated()
  }

  return (
    <Card
      title="New task"
      desc="Pick who it's for, trim the list, and assign."
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Target picker — a FORM FIELD only. Filtering the task list below is
            a separate control; the two must never drive each other. */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <SegmentTab
            active={mode === 'committee'}
            onClick={() => switchMode('committee')}
            icon={UsersRound}
            label="Committee"
          />
          <SegmentTab
            active={mode === 'people'}
            onClick={() => switchMode('people')}
            icon={UserCircle}
            label="People"
          />
        </div>

        {mode === 'committee' ? (
          committees.length === 0 ? (
            <p className="text-sm text-gray-400">
              No committees yet — assign to people instead.
            </p>
          ) : (
            <select
              value={committeeId}
              onChange={(e) => pickCommittee(e.target.value)}
              className={inputClass}
            >
              <option value="">— Choose a committee —</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        ) : (
          <div className="space-y-2.5">
            <MemberSearch
              members={members}
              excludeIds={selected}
              onPick={(m) => addIds([m.id])}
            />
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => addIds(chip.ids)}
                  className="rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-maroon/40 hover:bg-maroon/5 hover:text-maroon"
                >
                  + {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The resolved set, as removable pills. */}
        {selected.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <MemberPill
                  key={id}
                  name={memberById[id]?.full_name ?? 'Member'}
                  onRemove={() =>
                    setSelected((prev) => prev.filter((x) => x !== id))
                  }
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-maroon">
              Assigning to {selected.length}{' '}
              {selected.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        )}

        <Labeled label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Draft the spring fundraiser proposal"
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </Labeled>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2.5">
            <Toggle checked={hasDue} onChange={setHasDue} />
            <span className="text-sm font-medium text-gray-600">Set a due date</span>
          </label>
          {hasDue && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
            />
          )}
          <label className="flex items-center gap-2.5">
            <Toggle checked={requiresEach} onChange={setRequiresEach} />
            <span className="text-sm font-medium text-gray-600">
              Everyone must submit
              <span className="block text-xs font-normal text-gray-400">
                Off: any one submission completes the task.
              </span>
            </span>
          </label>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !title.trim() || selected.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Assign task
        </button>
      </form>
    </Card>
  )
}

/* ─────────────────────────── all tasks ─────────────────────────── */

function AllTasksCard({
  tasks,
  assigneesByTask,
  subsByTask,
  members,
  committees,
  initialCommittee,
  onChanged,
}) {
  // These filters scope the LIST only — they are independent of the create
  // form's target picker above (conflating the two was the old page's bug).
  const [committeeFilter, setCommitteeFilter] = useState(initialCommittee ?? 'all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('')

  const filtered = tasks.filter((t) => {
    if (committeeFilter === 'none' && t.committee_id) return false
    if (
      committeeFilter !== 'all' &&
      committeeFilter !== 'none' &&
      t.committee_id !== committeeFilter
    )
      return false
    const { complete, overdue } = taskProgress(
      t,
      assigneesByTask[t.id] ?? [],
      subsByTask[t.id] ?? [],
    )
    if (statusFilter === 'open' && complete) return false
    if (statusFilter === 'complete' && !complete) return false
    if (statusFilter === 'overdue' && !overdue) return false
    const term = memberFilter.trim().toLowerCase()
    if (term) {
      const names = (assigneesByTask[t.id] ?? []).map((a) =>
        (a.member?.full_name ?? '').toLowerCase(),
      )
      if (!names.some((n) => n.includes(term))) return false
    }
    return true
  })

  return (
    <Card title="All tasks" desc="Review submissions and adjust who's assigned.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          className={filterClass}
        >
          <option value="all">All committees</option>
          <option value="none">No committee</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={filterClass}
        >
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="overdue">Overdue</option>
          <option value="complete">Complete</option>
        </select>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder="Filter by member…"
            className={`${filterClass} w-full pl-8`}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match these filters.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <ManageTaskRow
              key={t.id}
              task={t}
              assignees={assigneesByTask[t.id] ?? []}
              submissions={subsByTask[t.id] ?? []}
              members={members}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ManageTaskRow({ task, assignees, submissions, members, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const { complete, overdue, submittedCount } = taskProgress(task, assignees, submissions)

  async function remove() {
    if (
      !window.confirm(
        `Delete "${task.title}"? Its submissions will also be removed. This cannot be undone.`,
      )
    )
      return
    const { error: delErr } = await supabase.from('tasks').delete().eq('id', task.id)
    if (delErr) {
      setError('Could not delete the task.')
      return
    }
    onChanged()
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-gray-200 p-4">
        <EditTaskForm
          task={task}
          onSaved={() => {
            setEditing(false)
            onChanged()
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-start justify-between gap-2 p-4">
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
          )}
          <span className="min-w-0">
            <span className="block font-semibold text-maroon">{task.title}</span>
            <span className="mt-0.5 block text-xs text-gray-400">
              {task.committee?.name ? `${task.committee.name} · ` : ''}
              {assignees.length} assigned ·{' '}
              {task.requires_each
                ? `${submittedCount}/${assignees.length} submitted`
                : `${submissions.length} submission${submissions.length === 1 ? '' : 's'}`}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {complete ? (
            <StatusChip tone="green" icon={CheckCircle2} label="Complete" />
          ) : (
            <DueBadge due={task.due_date} overdue={overdue} />
          )}
          <button
            onClick={() => setEditing(true)}
            title="Edit task"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={remove}
            title="Delete task"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-gray-100 p-4">
          {task.description && (
            <p className="whitespace-pre-line text-sm text-gray-600">
              {task.description}
            </p>
          )}

          <AssigneeEditor
            task={task}
            assignees={assignees}
            members={members}
            submissions={submissions}
            onChanged={onChanged}
          />

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Submissions ({submissions.length})
            </p>
            {submissions.length === 0 ? (
              <p className="mt-1 text-sm text-gray-400">No submissions yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 border-l-2 border-maroon/15 pl-3">
                {submissions.map((s) => (
                  <SubmissionRow
                    key={s.id}
                    submission={s}
                    canDelete
                    onDeleted={onChanged}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
    </li>
  )
}

// Snapshot semantics make this editor necessary: new committee members don't
// inherit existing tasks, so officers add (or remove) assignees here instead.
function AssigneeEditor({ task, assignees, members, submissions, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitted = new Set(submissions.map((s) => s.member_id))

  async function add(member) {
    setBusy(true)
    setError('')
    const { error: insErr } = await supabase
      .from('task_assignees')
      .insert({ task_id: task.id, member_id: member.id })
    setBusy(false)
    if (insErr) {
      setError('Could not add this assignee.')
      return
    }
    onChanged()
  }

  async function remove(memberId) {
    setBusy(true)
    setError('')
    const { error: delErr } = await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', task.id)
      .eq('member_id', memberId)
    setBusy(false)
    if (delErr) {
      setError('Could not remove this assignee.')
      return
    }
    onChanged()
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Assignees ({assignees.length})
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {assignees.map((a) => (
          <MemberPill
            key={a.member_id}
            name={a.member?.full_name ?? 'Member'}
            done={submitted.has(a.member_id)}
            onRemove={busy ? undefined : () => remove(a.member_id)}
          />
        ))}
      </div>
      <div className="mt-2 max-w-sm">
        <MemberSearch
          members={members}
          excludeIds={assignees.map((a) => a.member_id)}
          onPick={add}
          placeholder="Add an assignee…"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function EditTaskForm({ task, onSaved, onCancel }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [hasDue, setHasDue] = useState(Boolean(task.due_date))
  const [dueDate, setDueDate] = useState(task.due_date ?? todayISO())
  const [requiresEach, setRequiresEach] = useState(task.requires_each)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setSaving(true)
    setError('')
    const { error: updErr } = await supabase
      .from('tasks')
      .update({
        title: t,
        description: description.trim(),
        due_date: hasDue ? dueDate : null,
        requires_each: requiresEach,
      })
      .eq('id', task.id)
    setSaving(false)
    if (updErr) {
      setError('Could not save changes.')
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className={inputClass}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2.5">
          <Toggle checked={hasDue} onChange={setHasDue} />
          <span className="text-sm font-medium text-gray-600">Set a due date</span>
        </label>
        {hasDue && (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
          />
        )}
        <label className="flex items-center gap-2.5">
          <Toggle checked={requiresEach} onChange={setRequiresEach} />
          <span className="text-sm font-medium text-gray-600">Everyone must submit</span>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-gray-500 hover:text-maroon"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ─────────────────────── submissions (shared) ─────────────────────── */

function SubmissionRow({ submission, canDelete, onDeleted }) {
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function openFile() {
    setOpening(true)
    setError('')
    const tab = window.open('', '_blank')
    const { data, error: fnError } = await supabase.functions.invoke(
      'task-file-url',
      { body: { submission_id: submission.id } },
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
    if (!window.confirm('Delete this submission? This cannot be undone.')) return
    setDeleting(true)
    const { error: delErr } = await supabase
      .from('task_submissions')
      .delete()
      .eq('id', submission.id)
    setDeleting(false)
    if (delErr) {
      setError('Could not delete this submission.')
      return
    }
    onDeleted()
  }

  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">
            {submission.submitter?.full_name ?? 'Member'} ·{' '}
            {new Date(submission.created_at).toLocaleDateString()}
          </p>
          {submission.body && (
            <p className="mt-0.5 whitespace-pre-line text-sm text-maroon">
              {submission.body}
            </p>
          )}
          {submission.has_file && (
            <button
              onClick={openFile}
              disabled={opening}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-maroon px-3 py-1.5 text-xs font-semibold text-maroon transition hover:bg-maroon/5 disabled:opacity-60"
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
            title="Delete submission"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

function SubmitForm({ task, onSubmitted }) {
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
        .from('committee-task-files')
        .upload(filePath, file, { upsert: false })
      if (uploadError) {
        setSaving(false)
        setError('File upload failed. Please try again.')
        return
      }
    }

    const { error: insertError } = await supabase.from('task_submissions').insert({
      task_id: task.id,
      member_id: profile.id,
      body: text || null,
      file_url: filePath,
    })

    setSaving(false)
    if (insertError) {
      // Roll back the orphaned upload if the row insert failed.
      if (filePath)
        await supabase.storage.from('committee-task-files').remove([filePath])
      setError('Could not submit. Please try again.')
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
        placeholder="Write your submission, or attach a file below…"
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

/* ─────────────────────────── shared bits ─────────────────────────── */

// Completion under the task's rule: requires_each = every assignee has
// submitted; otherwise any one submission does it. Overdue only while open.
function taskProgress(task, assignees, submissions) {
  const submitted = new Set(submissions.map((s) => s.member_id))
  const submittedCount = assignees.filter((a) => submitted.has(a.member_id)).length
  const complete = task.requires_each
    ? assignees.length > 0 && submittedCount === assignees.length
    : submissions.length > 0
  const overdue = !complete && Boolean(task.due_date) && task.due_date < todayISO()
  return { complete, overdue, submittedCount }
}

function groupBy(rows, key) {
  const map = {}
  for (const r of rows) (map[r[key]] ??= []).push(r)
  return map
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

const filterClass =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-600 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function Card({ title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {(title || desc) && (
        <div className="border-b border-gray-100 p-5">
          {title && (
            <h2 className="font-display text-lg font-bold text-maroon">{title}</h2>
          )}
          {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-maroon">
      <Icon className="h-4 w-4" /> {children}
    </h2>
  )
}

function SegmentTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-maroon text-white shadow-sm' : 'text-gray-500 hover:text-maroon'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function MemberPill({ name, done, onRemove }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-1 pl-2.5 text-xs font-medium ${
        onRemove ? 'pr-1' : 'pr-2.5'
      } ${done ? 'bg-green-50 text-green-700' : 'bg-maroon/8 text-maroon'}`}
    >
      {done && <CheckCircle2 className="h-3 w-3" />}
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={`Remove ${name}`}
          className="grid h-4.5 w-4.5 place-items-center rounded-full transition hover:bg-maroon/15"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

// Debounced-feeling member picker over an already-loaded profile list (school
// scale, so client-side filtering beats a round trip per keystroke).
function MemberSearch({ members, excludeIds, onPick, placeholder = 'Add a member by name…' }) {
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const term = query.trim().toLowerCase()
  const results = term
    ? members
        .filter(
          (m) =>
            !excludeIds.includes(m.id) &&
            m.full_name.toLowerCase().includes(term),
        )
        .slice(0, 8)
    : []

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          placeholder={placeholder}
          className={`${inputClass} pl-9`}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(m)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-maroon/5"
              >
                <span className="truncate font-medium text-maroon">
                  {m.full_name}
                </span>
                <Plus className="h-4 w-4 shrink-0 text-maroon" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && term && results.length === 0 && (
        <p className="mt-1 px-1 text-xs text-gray-400">No matching members.</p>
      )}
    </div>
  )
}

function StatusChip({ tone, icon: Icon, label }) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-100 text-gray-500',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  )
}

function DueBadge({ due, overdue }) {
  if (!due)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
        <CalendarClock className="h-3 w-3" /> No due date
      </span>
    )
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        overdue ? 'bg-red-50 text-red-600' : 'bg-maroon/10 text-maroon'
      }`}
    >
      {overdue ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <CalendarClock className="h-3 w-3" />
      )}
      {overdue ? 'Overdue · ' : 'Due '}
      {formatDate(due, { month: 'short', day: 'numeric', year: 'numeric' })}
    </span>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-maroon">{label}</span>
      {children}
    </label>
  )
}

function Loading() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-maroon" />
    </div>
  )
}
