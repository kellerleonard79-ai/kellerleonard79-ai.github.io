import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Plus, ArrowRight, Loader2, X } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, todayISO } from '../lib/format.js'

export default function Meetings() {
  return (
    <RequireStaff>
      <MeetingsContent />
    </RequireStaff>
  )
}

function MeetingsContent() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*, attendance(count)')
      .order('date', { ascending: false })
    setMeetings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = todayISO()
  const upcoming = useMemo(
    () =>
      meetings
        .filter((m) => m.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [meetings, today],
  )
  const past = useMemo(() => {
    const term = search.trim().toLowerCase()
    return meetings
      .filter((m) => m.date < today)
      .filter((m) => !term || m.title.toLowerCase().includes(term))
  }, [meetings, today, search])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Meetings
            </h1>
            <p className="mt-1 text-gray-500">Schedule, agendas, and attendance</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
            >
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Link>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Cancel' : 'New meeting'}
            </button>
          </div>
        </div>

        {showForm && (
          <CreateMeetingForm
            onCreated={() => {
              setShowForm(false)
              load()
            }}
          />
        )}

        {/* Upcoming */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Upcoming
          </h2>
          {loading ? (
            <EmptyCard>Loading…</EmptyCard>
          ) : upcoming.length === 0 ? (
            <EmptyCard>No upcoming meetings. Create one above.</EmptyCard>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.map((m) => (
                <MeetingRow key={m.id} meeting={m} />
              ))}
            </ul>
          )}
        </section>

        {/* Past */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Past meetings
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(query)
              }}
              className="flex items-center gap-2"
            >
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (e.target.value === '') setSearch('')
                }}
                placeholder="Search by title…"
                className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20 sm:w-56"
              />
              <button
                type="submit"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <EmptyCard>Loading…</EmptyCard>
          ) : past.length === 0 ? (
            <EmptyCard>
              {search ? 'No meetings match your search.' : 'No past meetings yet.'}
            </EmptyCard>
          ) : (
            <ul className="mt-3 space-y-3">
              {past.map((m) => (
                <MeetingRow key={m.id} meeting={m} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Footer />
    </div>
  )
}

function MeetingRow({ meeting }) {
  const attended = meeting.attendance?.[0]?.count ?? 0
  return (
    <li>
      <Link
        to={`/dashboard/meetings/${meeting.id}`}
        className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-maroon/30 hover:shadow-md"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-gray-900">
              {meeting.title}
            </p>
            {meeting.is_active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
                Live
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {formatDate(meeting.date)} · {attended} attended
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-maroon" />
      </Link>
    </li>
  )
}

function EmptyCard({ children }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white/50 px-5 py-8 text-center text-sm text-gray-400">
      {children}
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
    onCreated()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="font-display text-lg font-bold text-maroon">
        New Meeting
      </h2>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
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
        <label className="block">
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
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Agenda summary <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <textarea
          rows={2}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          className={`${inputClass} resize-y`}
          placeholder="Short description…"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 font-semibold text-maroon-dark shadow transition hover:bg-gold-light disabled:opacity-60"
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

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
