import { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
  AlertTriangle,
  FileText,
  UsersRound,
  UserCircle,
} from 'lucide-react'
import RequirePermission from '../components/RequirePermission.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, todayISO } from '../lib/format.js'

// Dedicated console for assigning work. An officer (manage_assignments) creates a
// task targeting either a committee (the whole committee's members can submit) or
// an individual member. Both target types share the committee_tasks table and the
// committee_task_submissions model; submissions are reviewed here and — for the
// member's own view — contextually (committee dashboard / member profile).
export default function Assignments() {
  return (
    <RequirePermission permission="manage_assignments">
      <AssignmentsContent />
    </RequirePermission>
  )
}

function AssignmentsContent() {
  const [mode, setMode] = useState('committee') // 'committee' | 'individual'
  const [committees, setCommittees] = useState([])
  const [members, setMembers] = useState([])
  const [committeeId, setCommitteeId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('committees').select('id, name').order('name', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true }),
    ]).then(([{ data: comms }, { data: mems }]) => {
      setCommittees(comms ?? [])
      setMembers((mems ?? []).filter((m) => m.full_name))
      setCommitteeId((prev) => prev || comms?.[0]?.id || '')
      setLoading(false)
    })
  }, [])

  const target =
    mode === 'committee'
      ? committeeId
        ? { type: 'committee', id: committeeId }
        : null
      : memberId
        ? { type: 'individual', id: memberId }
        : null

  const targetLabel =
    mode === 'committee'
      ? committees.find((c) => c.id === committeeId)?.name ?? 'this committee'
      : members.find((m) => m.id === memberId)?.full_name ?? 'this member'

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-maroon">Assignments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Assign work to a committee or an individual member, then review their
          submissions.
        </p>
      </header>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Card
            title="Who is this for?"
            desc="Choose a committee (all its members can submit) or a single member."
          >
            <div className="space-y-4">
              {/* Target-type toggle */}
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <TargetTab
                  active={mode === 'committee'}
                  onClick={() => setMode('committee')}
                  icon={UsersRound}
                  label="Committee"
                />
                <TargetTab
                  active={mode === 'individual'}
                  onClick={() => setMode('individual')}
                  icon={UserCircle}
                  label="Individual member"
                />
              </div>

              {mode === 'committee' ? (
                committees.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No committees yet. Create a committee first, or assign to an
                    individual member instead.
                  </p>
                ) : (
                  <select
                    value={committeeId}
                    onChange={(e) => setCommitteeId(e.target.value)}
                    className={inputClass}
                  >
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )
              ) : members.length === 0 ? (
                <p className="text-sm text-gray-400">No members found.</p>
              ) : (
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Choose a member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Card>

          {target ? (
            <TaskManager
              key={`${target.type}:${target.id}`}
              target={target}
              targetLabel={targetLabel}
            />
          ) : (
            <Card>
              <p className="py-4 text-center text-sm text-gray-400">
                Choose a member above to assign and review their work.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TargetTab({ active, onClick, icon: Icon, label }) {
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

function TaskManager({ target, targetLabel }) {
  const [tasks, setTasks] = useState([])
  const [subsByTask, setSubsByTask] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const column = target.type === 'committee' ? 'committee_id' : 'assignee_id'
    const { data: taskRows } = await supabase
      .from('committee_tasks')
      .select('id, committee_id, assignee_id, title, description, due_date, created_at')
      .eq(column, target.id)
      .order('created_at', { ascending: false })
    const list = taskRows ?? []
    setTasks(list)

    const ids = list.map((t) => t.id)
    const grouped = {}
    if (ids.length) {
      const { data: subs } = await supabase
        .from('committee_task_submissions')
        .select(
          'id, task_id, submitted_by, body, has_file, created_at, submitter:profiles(full_name)',
        )
        .in('task_id', ids)
        .order('created_at', { ascending: false })
      for (const s of subs ?? []) (grouped[s.task_id] ??= []).push(s)
    }
    setSubsByTask(grouped)
    setLoading(false)
  }, [target])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <NewTaskForm target={target} targetLabel={targetLabel} onCreated={load} />

      <Card title="Assigned tasks" desc="Member submissions appear under each task.">
        {loading ? (
          <Loading />
        ) : tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No tasks assigned to {targetLabel} yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                submissions={subsByTask[t.id] ?? []}
                onChanged={load}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function NewTaskForm({ target, targetLabel, onCreated }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hasDue, setHasDue] = useState(false)
  const [dueDate, setDueDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    if (hasDue && !dueDate) {
      setError('Choose a due date, or turn off "Set a due date".')
      return
    }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('committee_tasks').insert({
      committee_id: target.type === 'committee' ? target.id : null,
      assignee_id: target.type === 'individual' ? target.id : null,
      title: t,
      description: description.trim(),
      due_date: hasDue ? dueDate : null,
      created_by: profile.id,
    })
    setSaving(false)
    if (insertError) {
      setError('Could not create the task.')
      return
    }
    setTitle('')
    setDescription('')
    setHasDue(false)
    setDueDate(todayISO())
    onCreated()
  }

  return (
    <Card title="New task" desc={`Assign a task to ${targetLabel}.`}>
      <form onSubmit={submit} className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Toggle checked={hasDue} onChange={setHasDue} />
            <span className="text-sm font-medium text-gray-600">Set a due date</span>
          </div>
          {hasDue && (
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
            />
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !title.trim()}
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

function DueBadge({ due }) {
  if (!due)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
        <CalendarClock className="h-3 w-3" /> No due date
      </span>
    )
  const overdue = due < todayISO()
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

function TaskRow({ task, submissions, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [hasDue, setHasDue] = useState(Boolean(task.due_date))
  const [dueDate, setDueDate] = useState(task.due_date ?? todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setSaving(true)
    setError('')
    const { error: updErr } = await supabase
      .from('committee_tasks')
      .update({
        title: t,
        description: description.trim(),
        due_date: hasDue ? dueDate : null,
      })
      .eq('id', task.id)
    setSaving(false)
    if (updErr) {
      setError('Could not save changes.')
      return
    }
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${task.title}"? Its submissions will also be removed. This cannot be undone.`,
      )
    )
      return
    const { error: delErr } = await supabase
      .from('committee_tasks')
      .delete()
      .eq('id', task.id)
    if (delErr) {
      setError('Could not delete the task.')
      return
    }
    onChanged()
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-gray-200 p-4">
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Toggle checked={hasDue} onChange={setHasDue} />
              <span className="text-sm font-medium text-gray-600">Set a due date</span>
            </div>
            {hasDue && (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
              />
            )}
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
              onClick={() => {
                setTitle(task.title)
                setDescription(task.description)
                setHasDue(Boolean(task.due_date))
                setDueDate(task.due_date ?? todayISO())
                setError('')
                setEditing(false)
              }}
              className="text-sm font-medium text-gray-500 hover:text-maroon"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-maroon">{task.title}</p>
          {task.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DueBadge due={task.due_date} />
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

      <div className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
          Submissions ({submissions.length})
        </p>
        {submissions.length === 0 ? (
          <p className="mt-1 text-sm text-gray-400">No submissions yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 border-l-2 border-maroon/15 pl-3">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} submission={s} onDeleted={onChanged} />
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  )
}

function SubmissionRow({ submission, onDeleted }) {
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function openFile() {
    setOpening(true)
    setError('')
    const tab = window.open('', '_blank')
    const { data, error: fnError } = await supabase.functions.invoke(
      'committee-task-file-url',
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
      .from('committee_task_submissions')
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
            {submission.submitter?.full_name ?? 'Unknown'} ·{' '}
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
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  )
}

/* ───────────────────────── shared bits (match AdminSettings styling) ───────────────────────── */
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

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

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
