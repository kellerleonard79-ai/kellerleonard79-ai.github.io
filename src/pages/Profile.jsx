import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Loader2,
  Trash2,
  ClipboardList,
  CalendarClock,
  AlertTriangle,
  FileText,
  Upload,
  Send,
} from 'lucide-react'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { formatDate, formatTime, gradeLabel, todayISO } from '../lib/format.js'

// Two entry points share one view (both inside the DashboardLayout shell,
// which guarantees a signed-in session):
//   /dashboard/profile          -> a member's own profile (any clearance)
//   /dashboard/members/:id      -> staff viewing another member's profile
export default function Profile() {
  const { id } = useParams()
  if (id) {
    return (
      <RequireStaff>
        <ProfileContent
          profileId={id}
          backTo="/dashboard/members"
          backLabel="Directory"
          allowAdminControls
        />
      </RequireStaff>
    )
  }
  return <OwnProfile />
}

function OwnProfile() {
  const { profile } = useAuth()
  if (!profile) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }
  return <ProfileContent profileId={profile.id} backTo="/" backLabel="Home" />
}

function ProfileContent({ profileId, backTo, backLabel, allowAdminControls }) {
  const { hasPermission, profile: authProfile } = useAuth()
  const canManage = allowAdminControls && hasPermission('manage_roles')
  // Individual assignments: the member sees & submits their own; an assigning
  // officer reviewing a profile sees that member's tasks + submissions.
  const isOwn = authProfile?.id === profileId
  const canReview = hasPermission('manage_assignments')
  const showAssignments = isOwn || canReview
  const [profile, setProfile] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [tasks, setTasks] = useState([])
  const [subsByTask, setSubsByTask] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: a }, { data: taskRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supabase
        .from('attendance')
        .select('status, checked_in_at, meetings(title, date)')
        .eq('profile_id', profileId)
        .order('checked_in_at', { ascending: false }),
      supabase
        .from('committee_tasks')
        .select('id, title, description, due_date, created_at')
        .eq('assignee_id', profileId)
        .order('created_at', { ascending: false }),
    ])
    setProfile(p)
    setNotFound(!p)
    setAttendance(a ?? [])

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
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c = { present: 0, excused: 0, unexcused: 0 }
    for (const a of attendance) if (a.status in c) c[a.status] += 1
    return c
  }, [attendance])

  if (loading) {
    return (
      <Shell backTo={backTo} backLabel={backLabel}>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }
  if (notFound) {
    return (
      <Shell backTo={backTo} backLabel={backLabel}>
        <p className="py-20 text-center text-gray-500">Member not found.</p>
      </Shell>
    )
  }

  const statusActive = (profile.status ?? 'active') === 'active'

  return (
    <Shell backTo={backTo} backLabel={backLabel}>
      {/* Member card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-maroon">
              {profile.full_name ?? 'Member'}
            </h1>
            {profile.student_id && (
              <p className="mt-1 text-gray-500">ID {profile.student_id}</p>
            )}
            {profile.position && (
              <p className="mt-1 font-semibold text-maroon">{profile.position}</p>
            )}
          </div>
          {profile.academy && (
            <span className="shrink-0 rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-maroon">
              {profile.academy}
            </span>
          )}
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Field label="Grade" value={gradeLabel(profile.grade_level)} />
          <Field label="Shirt size" value={profile.shirt_size} />
          <Field label="Email" value={profile.email} />
          <Field label="Dues">
            <span
              className={`font-semibold ${
                profile.dues_paid ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profile.dues_paid ? 'PAID' : 'UNPAID'}
            </span>
          </Field>
          <Field label="Member status">
            <span
              className={`font-semibold uppercase ${
                statusActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {profile.status ?? 'active'}
            </span>
          </Field>
          <Field label="Joined" value={formatDateTime(profile.created_at)} />
        </dl>
      </section>

      {canManage && (
        <AdminControls profile={profile} onChanged={load} />
      )}

      {/* Attendance */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-lg font-bold text-maroon">Attendance</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatBox
            value={counts.present}
            label="Sessions attended"
            className="border-green-100 bg-green-50 text-green-700"
          />
          <StatBox
            value={counts.excused}
            label="Excused absences"
            className="border-amber-100 bg-amber-50 text-amber-700"
          />
          <StatBox
            value={counts.unexcused}
            label="Unexcused absences"
            className="border-red-100 bg-red-50 text-red-700"
          />
        </div>

        {attendance.length === 0 ? (
          <p className="mt-6 text-sm text-gray-400">No attendance records yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {attendance.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-maroon">
                    {a.meetings?.title ?? 'Meeting'}
                    {a.meetings?.date && (
                      <span className="text-gray-500">
                        {' '}
                        – {formatDate(a.meetings.date)}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {formatDateTime(a.checked_in_at)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAssignments && (
        <AssignmentsSection
          tasks={tasks}
          subsByTask={subsByTask}
          isOwn={isOwn}
          canReview={canReview}
          currentUserId={authProfile?.id}
          onChanged={load}
        />
      )}
    </Shell>
  )
}

// Individual (person-targeted) assignments for this profile. The assigned member
// submits work here (text + optional file, same model as committee tasks); an
// assigning officer reviewing the profile sees the tasks and submissions.
function AssignmentsSection({
  tasks,
  subsByTask,
  isOwn,
  canReview,
  currentUserId,
  onChanged,
}) {
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-maroon">
        <ClipboardList className="h-5 w-5" /> Assignments
        <span className="text-sm font-normal text-gray-400">({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          {isOwn
            ? 'No individual assignments right now.'
            : 'This member has no individual assignments.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {tasks.map((t) => (
            <IndividualTaskCard
              key={t.id}
              task={t}
              submissions={subsByTask[t.id] ?? []}
              isOwn={isOwn}
              canReview={canReview}
              currentUserId={currentUserId}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskDueBadge({ due }) {
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

function IndividualTaskCard({
  task,
  submissions,
  isOwn,
  canReview,
  currentUserId,
  onChanged,
}) {
  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-maroon">{task.title}</p>
          {task.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
              {task.description}
            </p>
          )}
        </div>
        <TaskDueBadge due={task.due_date} />
      </div>

      {submissions.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-maroon/15 pl-3">
          {submissions.map((s) => (
            <TaskSubmissionRow
              key={s.id}
              submission={s}
              canDelete={canReview || s.submitted_by === currentUserId}
              onDeleted={onChanged}
            />
          ))}
        </ul>
      )}

      {isOwn && (
        <div className="mt-3">
          <TaskSubmissionForm
            task={task}
            currentUserId={currentUserId}
            onSubmitted={onChanged}
          />
        </div>
      )}
    </li>
  )
}

function TaskSubmissionRow({ submission, canDelete, onDeleted }) {
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
    const { error: delError } = await supabase
      .from('committee_task_submissions')
      .delete()
      .eq('id', submission.id)
    setDeleting(false)
    if (delError) {
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

function TaskSubmissionForm({ task, currentUserId, onSubmitted }) {
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
      filePath = `${currentUserId}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('committee-task-files')
        .upload(filePath, file, { upsert: false })
      if (uploadError) {
        setSaving(false)
        setError('File upload failed. Please try again.')
        return
      }
    }

    const { error: insertError } = await supabase
      .from('committee_task_submissions')
      .insert({
        task_id: task.id,
        submitted_by: currentUserId,
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
        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
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

function Field({ label, value, children }) {
  return (
    <div>
      <dt className="text-sm text-gray-400">{label}</dt>
      <dd className="mt-1 text-maroon">
        {children ?? (value ? value : <span className="text-gray-400">—</span>)}
      </dd>
    </div>
  )
}

// Maps a role to the legacy clearance_level string so the two stay in sync
// while the app still reads clearance_level in places (isStaff, nav, badges).
function clearanceForRole(role) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

// SCI-only edit panel: change role, change elected position, approve / set
// member status, toggle dues, and delete the account.
function AdminControls({ profile, onChanged }) {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [positions, setPositions] = useState([])
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase
      .from('roles')
      .select('id, name, permissions, is_admin')
      .order('order', { ascending: true })
      .then(({ data }) => setRoles(data ?? []))
    supabase
      .from('elected_positions')
      .select('id, title, group')
      .order('group', { ascending: true })
      .order('order', { ascending: true })
      .then(({ data }) => setPositions(data ?? []))
  }, [])

  async function patch(fields) {
    setBusy(true)
    await supabase.from('profiles').update(fields).eq('id', profile.id)
    setBusy(false)
    onChanged()
  }

  function changeRole(roleId) {
    const role = roles.find((r) => r.id === roleId)
    patch({ role_id: roleId, clearance_level: clearanceForRole(role) })
  }

  function changePosition(positionId) {
    const pos = positions.find((p) => p.id === positionId)
    patch({
      elected_position_id: positionId || null,
      position: pos ? pos.title : null,
    })
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Permanently delete ${
          profile.full_name ?? 'this member'
        }'s account and all of their attendance records? This cannot be undone.`,
      )
    )
      return
    setDeleting(true)
    // 1. Remove the auth.users record via the privileged Edge Function. This
    //    cascades the profiles row through the FK, but we delete it explicitly
    //    below too in case the cascade is ever changed.
    const { error: fnError } = await supabase.functions.invoke('delete-user', {
      body: { user_id: profile.id },
    })
    if (fnError) {
      setDeleting(false)
      window.alert(`Delete failed: ${fnError.message}`)
      return
    }
    // 2. Delete the profiles row (a no-op if the cascade already removed it).
    await supabase.from('profiles').delete().eq('id', profile.id)
    navigate('/dashboard/members', { replace: true })
  }

  const grouped = positions.reduce((acc, p) => {
    ;(acc[p.group] ??= []).push(p)
    return acc
  }, {})
  const isPending = (profile.status ?? 'active') === 'pending'

  return (
    <section className="mt-6 rounded-2xl border border-maroon/20 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-maroon">
          Officer controls
        </h2>
        <span className="rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-maroon">
          SCI only
        </span>
      </div>

      {isPending && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            This member is awaiting approval and cannot log in yet.
          </p>
          <button
            onClick={() => patch({ status: 'active' })}
            disabled={busy}
            className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            Approve membership
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-maroon">
            Role / clearance
          </span>
          <select
            value={profile.role_id ?? ''}
            onChange={(e) => changeRole(e.target.value)}
            disabled={busy}
            className={selectClass}
          >
            {!profile.role_id && <option value="">— None —</option>}
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-maroon">
            Elected position
          </span>
          <select
            value={profile.elected_position_id ?? ''}
            onChange={(e) => changePosition(e.target.value)}
            disabled={busy}
            className={selectClass}
          >
            <option value="">— None —</option>
            {Object.entries(grouped).map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-maroon">
            Member status
          </span>
          <select
            value={profile.status ?? 'active'}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={busy}
            className={selectClass}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <div className="block">
          <span className="mb-1.5 block text-sm font-semibold text-maroon">
            Dues
          </span>
          <button
            onClick={() => patch({ dues_paid: !profile.dues_paid })}
            disabled={busy}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
              profile.dues_paid
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {profile.dues_paid ? 'PAID — mark unpaid' : 'UNPAID — mark paid'}
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete account
        </button>
      </div>
    </section>
  )
}

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function StatBox({ value, label, className }) {
  return (
    <div className={`rounded-xl border p-5 text-center ${className}`}>
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm">{label}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const palette = {
    present: 'bg-green-100 text-green-700',
    excused: 'bg-amber-100 text-amber-700',
    unexcused: 'bg-red-100 text-red-700',
  }
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        palette[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  )
}

function formatDateTime(ts) {
  if (!ts) return ''
  return `${new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })} · ${formatTime(ts)}`
}

function Shell({ children, backTo = '/dashboard', backLabel = 'Dashboard' }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
