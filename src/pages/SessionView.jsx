import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import CheckinQR from '../components/CheckinQR.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, formatTime, checkinUrl } from '../lib/format.js'

const STATUSES = ['present', 'excused', 'unexcused']

export default function SessionView() {
  return (
    <RequireStaff>
      <SessionContent />
    </RequireStaff>
  )
}

function SessionContent() {
  const { id } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [members, setMembers] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const loadMeeting = useCallback(async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setMeeting(data)
  }, [id])

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
      .order('full_name', { ascending: true })
    setMembers(data ?? [])
  }, [])

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('profile_id, status, source, checked_in_at, profiles(full_name, student_id)')
      .eq('meeting_id', id)
      .order('checked_in_at', { ascending: false })
    setAttendance(data ?? [])
  }, [id])

  useEffect(() => {
    Promise.all([loadMeeting(), loadMembers(), loadAttendance()]).then(() =>
      setLoading(false),
    )
    const channel = supabase
      .channel(`session-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `meeting_id=eq.${id}` },
        () => loadAttendance(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, loadMeeting, loadMembers, loadAttendance])

  const statusByProfile = useMemo(() => {
    const map = {}
    for (const a of attendance) map[a.profile_id] = a.status
    return map
  }, [attendance])

  const present = useMemo(
    () => attendance.filter((a) => a.status === 'present').length,
    [attendance],
  )
  const total = members.length
  const needed = Math.ceil(total / 2)
  const quorumMet = total > 0 && present * 2 >= total
  const checkIns = useMemo(
    () => attendance.filter((a) => a.source === 'qr'),
    [attendance],
  )

  async function setStatus(profileId, status) {
    // Toggle off if clicking the active status.
    const current = statusByProfile[profileId]
    if (current === status) {
      await supabase
        .from('attendance')
        .delete()
        .eq('meeting_id', id)
        .eq('profile_id', profileId)
    } else {
      await supabase.from('attendance').upsert(
        { meeting_id: id, profile_id: profileId, status, source: 'manual' },
        { onConflict: 'meeting_id,profile_id' },
      )
    }
    loadAttendance()
  }

  async function toggleSession() {
    const opening = !meeting.is_active
    if (opening) {
      await supabase.from('meetings').update({ is_active: false }).neq('id', id)
    }
    await supabase.from('meetings').update({ is_active: opening }).eq('id', id)
    loadMeeting()
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

  const filtered = members.filter((m) =>
    m.full_name?.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const url = checkinUrl(meeting.id)

  return (
    <Shell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            {meeting.title}
          </h1>
          <p className="mt-1 text-gray-500">{formatDate(meeting.date)}</p>
        </div>
        <Link
          to={`/dashboard/meetings/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> Meeting
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm">
          <p className="text-3xl font-bold text-gray-900">
            {present} <span className="text-lg font-medium text-gray-400">/ {total}</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">Members present</p>
        </div>
        <div
          className={`rounded-2xl border p-5 text-center shadow-sm ${
            quorumMet
              ? 'border-green-200 bg-green-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p
            className={`font-display text-2xl font-bold ${
              quorumMet ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {quorumMet ? 'Quorum' : 'No quorum'}
          </p>
          <p
            className={`mt-1 text-sm ${
              quorumMet ? 'text-green-600' : 'text-amber-600'
            }`}
          >
            {quorumMet ? 'Met' : 'Not met'} — {present} of {needed} needed
          </p>
        </div>
      </div>

      {/* QR session */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
              meeting.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {meeting.is_active && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
            )}
            {meeting.is_active ? 'Session open' : 'Session closed'}
          </span>
        </div>
        <CheckinQR url={url} size={200} downloadName={`${meeting.title}-qr.png`}>
          <button
            onClick={toggleSession}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              meeting.is_active
                ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                : 'border border-green-300 text-green-700 hover:bg-green-50'
            }`}
          >
            {meeting.is_active ? 'Close session' : 'Reopen session'}
          </button>
        </CheckinQR>
        {!meeting.is_active && (
          <p className="mt-3 text-center text-xs text-amber-600">
            Students can only check in while the session is open.
          </p>
        )}
      </div>

      {/* Manual attendance */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Manual attendance</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member by name…"
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
        />
        <ul className="mt-3 divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <li className="py-3 text-sm text-gray-400">No members found.</li>
          ) : (
            filtered.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div>
                  <p className="font-medium text-gray-900">{m.full_name}</p>
                  <p className="text-xs text-gray-400">{m.student_id}</p>
                </div>
                <div className="flex gap-1.5">
                  {STATUSES.map((s) => (
                    <StatusButton
                      key={s}
                      status={s}
                      active={statusByProfile[m.id] === s}
                      onClick={() => setStatus(m.id, s)}
                    />
                  ))}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Check-ins */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Check-ins</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">{checkIns.length} total</span>
            <button
              onClick={loadAttendance}
              className="inline-flex items-center gap-1 font-medium text-maroon hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
        {checkIns.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No QR check-ins yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {checkIns.map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-gray-900">
                  {a.profiles?.full_name ?? 'Member'}
                </span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-700">
                    {a.status}
                  </span>
                  <span className="text-sm text-gray-400">
                    {formatTime(a.checked_in_at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  )
}

function StatusButton({ status, active, onClick }) {
  const palette = {
    present: active
      ? 'bg-green-100 text-green-700 border-green-300'
      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
    excused: active
      ? 'bg-amber-100 text-amber-700 border-amber-300'
      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
    unexcused: active
      ? 'bg-red-100 text-red-700 border-red-300'
      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize transition ${palette[status]}`}
    >
      {status}
    </button>
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
