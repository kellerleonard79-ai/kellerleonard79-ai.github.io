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
import RequireStaff from '../components/RequireStaff.jsx'
import CheckinQR from '../components/CheckinQR.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, checkinUrl } from '../lib/format.js'

export default function MeetingDetail() {
  return (
    <RequireStaff>
      <DetailContent />
    </RequireStaff>
  )
}

function DetailContent() {
  const { id } = useParams()
  const navigate = useNavigate()
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
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-gray-400 transition hover:text-maroon"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Agenda + QR session cards */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
          <SessionBadge active={meeting.is_active} />
        </Link>
      </div>

      {/* Share QR */}
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

      {/* Danger zone */}
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
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase
      .from('meetings')
      .update({ title: title.trim(), date })
      .eq('id', meeting.id)
    onDone()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
    <div className="min-h-screen bg-gray-50">
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
