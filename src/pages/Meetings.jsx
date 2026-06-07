import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  CalendarPlus,
  Loader2,
  Power,
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  ClipboardCheck,
  ChevronLeft,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'

export default function Meetings() {
  return (
    <RequireStaff>
      <MeetingsContent />
    </RequireStaff>
  )
}

function MeetingsContent() {
  const [meetings, setMeetings] = useState([])
  const [totalProfiles, setTotalProfiles] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadMeetings = useCallback(async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setMeetings(data ?? [])
    setLoading(false)
  }, [])

  const loadTotalProfiles = useCallback(async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    setTotalProfiles(count ?? 0)
  }, [])

  useEffect(() => {
    loadMeetings()
    loadTotalProfiles()
  }, [loadMeetings, loadTotalProfiles])

  const activeMeeting = useMemo(
    () => meetings.find((m) => m.is_active) ?? null,
    [meetings],
  )

  async function toggleActive(meeting) {
    const activating = !meeting.is_active
    // Enforce a single active meeting at a time.
    if (activating) {
      await supabase
        .from('meetings')
        .update({ is_active: false })
        .neq('id', meeting.id)
    }
    await supabase
      .from('meetings')
      .update({ is_active: activating })
      .eq('id', meeting.id)
    loadMeetings()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>

        <header className="mb-8 mt-2">
          <h1 className="font-display text-3xl font-bold text-maroon">
            Meetings &amp; Attendance
          </h1>
          <p className="mt-1 text-gray-600">
            Manage meetings and track attendance.{' '}
            <span className="font-medium text-gray-800">{totalProfiles}</span>{' '}
            registered member{totalProfiles === 1 ? '' : 's'}.
          </p>
        </header>

        {activeMeeting && (
          <ActiveMeetingPanel
            meeting={activeMeeting}
            totalProfiles={totalProfiles}
            onDeactivate={() => toggleActive(activeMeeting)}
          />
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <CreateMeetingForm onCreated={loadMeetings} />
          <MeetingsList
            meetings={meetings}
            loading={loading}
            onToggle={toggleActive}
          />
        </div>
      </div>

      <Footer />
    </div>
  )
}

function CreateMeetingForm({ onCreated }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [agenda, setAgenda] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: insertError } = await supabase
      .from('meetings')
      .insert({ title: title.trim(), date, agenda: agenda.trim() || null })
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTitle('')
    setDate('')
    setAgenda('')
    onCreated()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-maroon">
        <CalendarPlus className="h-5 w-5" /> Create New Meeting
      </h2>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Title
        </span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="General Body Meeting"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Date
        </span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Agenda
        </span>
        <textarea
          rows={4}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          className={`${inputClass} resize-y`}
          placeholder="Topics to cover…"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 font-semibold text-maroon-dark shadow transition hover:bg-gold-light disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Saving…
          </>
        ) : (
          'Create Meeting'
        )}
      </button>
    </form>
  )
}

function MeetingsList({ meetings, loading, onToggle }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold text-maroon">Meetings</h2>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading meetings…</p>
      ) : meetings.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No meetings yet. Create your first one.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {meetings.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-gray-900">
                    {m.title}
                  </p>
                  {m.is_active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {formatDate(m.date)}
                  {m.agenda
                    ? ` · ${m.agenda.slice(0, 60)}${m.agenda.length > 60 ? '…' : ''}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => onToggle(m)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  m.is_active
                    ? 'bg-maroon text-white hover:bg-maroon-dark'
                    : 'border border-maroon text-maroon hover:bg-maroon/5'
                }`}
              >
                <Power className="h-4 w-4" />
                {m.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActiveMeetingPanel({ meeting, totalProfiles, onDeactivate }) {
  const [attendees, setAttendees] = useState([])
  const [copied, setCopied] = useState(false)

  const loadAttendees = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('checked_in_at, profiles(full_name, student_id)')
      .eq('meeting_id', meeting.id)
      .order('checked_in_at', { ascending: true })
    setAttendees(data ?? [])
  }, [meeting.id])

  useEffect(() => {
    loadAttendees()
    // Live updates: re-pull the roster whenever someone checks in.
    const channel = supabase
      .channel(`attendance-${meeting.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `meeting_id=eq.${meeting.id}`,
        },
        () => loadAttendees(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meeting.id, loadAttendees])

  const present = attendees.length
  const needed = Math.ceil(totalProfiles / 2)
  const pct = totalProfiles > 0 ? Math.round((present / totalProfiles) * 100) : 0
  const quorumMet = totalProfiles > 0 && present * 2 >= totalProfiles

  const checkinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/checkin/${meeting.id}`
      : `/checkin/${meeting.id}`

  function copyUrl() {
    navigator.clipboard?.writeText(checkinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-gold bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-maroon-dark to-maroon px-6 py-4 text-white">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-gold-light">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live Meeting
          </span>
          <h2 className="mt-1 font-display text-xl font-bold">{meeting.title}</h2>
          <p className="text-sm text-white/70">{formatDate(meeting.date)}</p>
        </div>
        <button
          onClick={onDeactivate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
        >
          <Power className="h-4 w-4" /> End Meeting
        </button>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        {/* Quorum calculator */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <Users className="h-5 w-5 text-maroon" /> Quorum Calculator
          </h3>

          <div className="mt-3 flex items-end gap-3">
            <span className="text-4xl font-bold text-maroon">{present}</span>
            <span className="pb-1 text-gray-500">
              / {totalProfiles} present ({pct}%)
            </span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${quorumMet ? 'bg-green-500' : 'bg-gold'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              quorumMet
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {quorumMet ? (
              <>
                <CheckCircle2 className="h-5 w-5" /> Quorum met — majority present
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" /> No quorum — need {needed} (½ of{' '}
                {totalProfiles})
              </>
            )}
          </div>

          {/* Live roster */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-700">
              Checked in ({present})
            </p>
            {present === 0 ? (
              <p className="mt-2 text-sm text-gray-400">
                Waiting for students to scan in…
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {attendees.map((a, i) => (
                  <li
                    key={i}
                    className="rounded-full bg-maroon/5 px-3 py-1 text-sm text-maroon"
                  >
                    {a.profiles?.full_name ?? 'Member'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* QR check-in */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
          <h3 className="flex items-center justify-center gap-2 font-semibold text-gray-900">
            <ClipboardCheck className="h-5 w-5 text-maroon" /> Scan to Check In
          </h3>
          <div className="mt-4 inline-block rounded-xl bg-white p-3 shadow-sm">
            <QRCodeSVG value={checkinUrl} size={180} fgColor="#6b1d2b" level="M" />
          </div>
          <button
            onClick={copyUrl}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy check-in link'}
          </button>
          <p className="mt-2 break-all text-xs text-gray-400">{checkinUrl}</p>
        </div>
      </div>
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  // d is a YYYY-MM-DD date string; parse as local to avoid TZ off-by-one.
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
