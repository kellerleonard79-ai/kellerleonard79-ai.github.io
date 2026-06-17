import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ClipboardList,
  QrCode,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import CheckinQR from '../components/CheckinQR.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  formatDate,
  formatDateTime,
  checkinUrl,
  isSessionOpen,
  toDatetimeLocal,
} from '../lib/format.js'

export default function MeetingDetail() {
  return (
    // Viewable by any member who can view_meetings; the management controls
    // below (edit, agenda editor, QR session, delete) stay gated on
    // create_meetings / edit_agendas so General Members get a read-only view.
    <RequirePermission permission="view_meetings">
      <DetailContent />
    </RequirePermission>
  )
}

function DetailContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('create_meetings')
  const canEditAgenda = hasPermission('edit_agendas')
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setMeeting(data)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (
      !window.confirm(
        'Permanently delete this meeting and all attendance & agenda data?',
      )
    )
      return
    setDeleting(true)
    await supabase.from('meetings').delete().eq('id', id)
    navigate('/dashboard/meetings', { replace: true })
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }

  if (!meeting) {
    return (
      <Shell>
        <p className="py-20 text-center text-gray-500">Meeting not found.</p>
      </Shell>
    )
  }

  const url = checkinUrl(meeting.id)

  return (
    <Shell>
      <Link
        to="/dashboard/meetings"
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
      >
        <ChevronLeft className="h-4 w-4" /> Meetings
      </Link>

      {/* Title card */}
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {editing ? (
          <EditMeeting
            meeting={meeting}
            onDone={() => {
              setEditing(false)
              load()
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-maroon">
                {meeting.title}
              </h1>
              <p className="mt-1 text-gray-500">{formatDate(meeting.date)}</p>
            </div>
            {canManage && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-gray-400 transition hover:text-maroon"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agenda + QR session cards. Both link to officer-only tools (agenda
          editor needs edit_agendas, QR session needs create_meetings), so they
          only appear for members who can use them. */}
      {(canEditAgenda || canManage) && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {canEditAgenda && (
            <Link
              to={`/dashboard/meetings/${meeting.id}/agenda`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition hover:border-maroon/30 hover:shadow-md"
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-maroon/8 text-maroon transition group-hover:bg-maroon group-hover:text-white">
                <ClipboardList className="h-6 w-6" />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-maroon">
                Agenda
              </h2>
              <p className="text-sm text-gray-500">View and edit</p>
            </Link>
          )}

          {canManage && (
            <Link
              to={`/dashboard/meetings/${meeting.id}/session`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition hover:border-maroon/30 hover:shadow-md"
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-maroon/8 text-maroon transition group-hover:bg-maroon group-hover:text-white">
                <QrCode className="h-6 w-6" />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-maroon">
                QR Session
              </h2>
              <SessionBadge active={isSessionOpen(meeting)} />
              {(meeting.session_start || meeting.session_end) && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Scheduled {formatDateTime(meeting.session_start)}
                </p>
              )}
            </Link>
          )}
        </div>
      )}

      {/* Share QR — managing the live check-in is an officer action. */}
      {canManage && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-center text-sm text-gray-500">
            Share this QR at the meeting for check-in
          </p>
          <div className="mt-4">
            <CheckinQR url={url} size={200} downloadName={`${meeting.title}-qr.png`}>
              <Link
                to={`/dashboard/meetings/${meeting.id}/session`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-maroon/30 px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
              >
                Full session view <ArrowRight className="h-4 w-4" />
              </Link>
            </CheckinQR>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {canManage && (
        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Permanently delete this meeting and all associated data.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete meeting
          </button>
        </div>
      )}
    </Shell>
  )
}

function SessionBadge({ active }) {
  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {active && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
      )}
      {active ? 'Open' : 'Closed'}
    </span>
  )
}

function EditMeeting({ meeting, onDone, onCancel }) {
  const [title, setTitle] = useState(meeting.title)
  const [date, setDate] = useState(meeting.date)
  const [scheduleSession, setScheduleSession] = useState(
    Boolean(meeting.session_start || meeting.session_end),
  )
  const [sessionStart, setSessionStart] = useState(
    toDatetimeLocal(meeting.session_start),
  )
  const [sessionEnd, setSessionEnd] = useState(
    toDatetimeLocal(meeting.session_end),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    // When scheduling is off, clear any existing window so check-in reverts to
    // manual-only. datetime-local values are local; normalize to UTC for storage.
    let session_start = null
    let session_end = null
    if (scheduleSession) {
      session_start = sessionStart ? new Date(sessionStart).toISOString() : null
      session_end = sessionEnd ? new Date(sessionEnd).toISOString() : null
      if (session_start && session_end && session_end <= session_start) {
        setError('Check-in close time must be after the open time.')
        return
      }
    }
    setSaving(true)
    await supabase
      .from('meetings')
      .update({ title: title.trim(), date, session_start, session_end })
      .eq('id', meeting.id)
    onDone()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {error}
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-maroon">
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-maroon">
          Date
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </label>

      {/* Scheduled QR check-in window */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:col-span-2">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={scheduleSession}
            onChange={(e) => setScheduleSession(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30"
          />
          <span className="text-sm font-semibold text-maroon">
            Schedule QR check-in window
          </span>
        </label>
        {scheduleSession && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-maroon">
                Opens
              </span>
              <input
                type="datetime-local"
                value={sessionStart}
                onChange={(e) => setSessionStart(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-maroon">
                Closes
              </span>
              <input
                type="datetime-local"
                value={sessionEnd}
                onChange={(e) => setSessionEnd(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-dark disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-maroon hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
      <Footer />
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
