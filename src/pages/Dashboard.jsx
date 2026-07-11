import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock,
  Vote,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, formatDateTime, todayISO } from '../lib/format.js'

// Same public PHS SGA calendar the homepage embeds; an admin can override it via
// site_settings.calendar_url. Kept in sync with Home.jsx's DEFAULT_CALENDAR_SRC.
const DEFAULT_CALENDAR_SRC =
  'https://calendar.google.com/calendar/embed?src=c_0660093bc692b20cf903cc9ebe8c8a7ab767b99fcd4a467cc5b55193b1926b40%40group.calendar.google.com&ctz=America%2FChicago&mode=AGENDA'

// Landing pane for /dashboard (the index route inside DashboardLayout). The
// sidebar is the shell's navigation, so this is a personalized overview — what's
// coming up for this member — rather than another set of links to the tools.
// Applicants awaiting officer review get the pending-approval notice instead.
export default function Dashboard() {
  const { profile, hasPermission } = useAuth()
  const { settings } = useSiteSettings()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Tiger'

  // Which sections a member sees is driven by the same permissions that gate the
  // tools themselves: general members can view meetings; only officers/admins
  // with view_elections see active cycles (RLS blocks the read otherwise).
  const canViewMeetings = hasPermission('view_meetings')
  const canViewElections = hasPermission('view_elections')

  const [meetings, setMeetings] = useState([])
  const [loadingMeetings, setLoadingMeetings] = useState(canViewMeetings)
  const [openCycles, setOpenCycles] = useState([])

  useEffect(() => {
    if (!canViewMeetings) return
    let active = true
    const today = todayISO()
    supabase
      .from('meetings')
      .select('id, title, date, is_active')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(4)
      .then(({ data }) => {
        if (!active) return
        setMeetings(data ?? [])
        setLoadingMeetings(false)
      })
    return () => {
      active = false
    }
  }, [canViewMeetings])

  useEffect(() => {
    if (!canViewElections) return
    let active = true
    // Only surface cycles that are actually taking part (is_open). Nothing shows
    // when there's no active cycle.
    supabase
      .from('election_cycles')
      .select('id, name, is_open, close_date, filing_deadline')
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        setOpenCycles(data ?? [])
      })
    return () => {
      active = false
    }
  }, [canViewElections])

  if (profile?.status === 'pending') {
    return <PendingWelcome profile={profile} firstName={firstName} />
  }

  const calendarSrc = settings?.calendar_url?.trim() || DEFAULT_CALENDAR_SRC

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-maroon">
          Welcome, {profile?.full_name ?? firstName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center rounded-full bg-maroon/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-maroon">
            {profile?.clearance_level ?? 'member'}
          </span>
          {profile?.student_id && <span>ID {profile.student_id}</span>}
        </p>
      </header>

      {/* Active election cycles — only for members who can view elections, and
          only when one is actually open. Sits full-width above the grid. */}
      {canViewElections && openCycles.length > 0 && (
        <section className="mt-8">
          <SectionHeading icon={Vote}>Elections</SectionHeading>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {openCycles.map((c) => (
              <Link
                key={c.id}
                to="/dashboard/elections"
                className="group flex items-start justify-between gap-4 rounded-2xl border border-maroon/20 bg-maroon/[0.03] px-5 py-4 shadow-sm transition hover:border-maroon/40 hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-maroon">{c.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                      Open
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {c.filing_deadline
                      ? `Filing closes ${formatDateTime(c.filing_deadline)}`
                      : c.close_date
                        ? `Voting closes ${formatDateTime(c.close_date)}`
                        : 'Applications are open'}
                  </p>
                </div>
                <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-maroon/40 transition group-hover:translate-x-0.5 group-hover:text-maroon" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* One grid, top-aligned: meetings and assignments share a row and read as
          a single composition; the calendar spans the full width below so its
          agenda renders without truncating titles. */}
      <div className="mt-8 grid items-start gap-x-8 gap-y-8 sm:grid-cols-2">
        {canViewMeetings && (
          <section>
            <SectionHeading icon={CalendarDays}>Upcoming meetings</SectionHeading>
            {loadingMeetings ? (
              <MutedNote>Loading…</MutedNote>
            ) : meetings.length === 0 ? (
              <MutedNote>No upcoming meetings scheduled.</MutedNote>
            ) : (
              <ul className="mt-3 space-y-3">
                {meetings.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/dashboard/meetings/${m.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-maroon/30 hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-maroon">
                            {m.title}
                          </p>
                          {m.is_active && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
                              Live
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(m.date)}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-maroon" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Assignments — the slot a future task/assignment system will fill. No
            data source exists yet, so this stays a compact empty state. */}
        <section>
          <SectionHeading icon={ClipboardList}>Assignments</SectionHeading>
          <MutedNote>
            No assignments yet — tasks assigned to you will show up here.
          </MutedNote>
        </section>

        {/* School calendar spans the full grid width for a clean agenda render. */}
        <section className="sm:col-span-2">
          <SectionHeading icon={CalendarDays}>Calendar</SectionHeading>
          <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <iframe
              title="PHS SGA School Calendar"
              src={calendarSrc}
              className="h-[440px] w-full sm:h-[480px]"
              style={{ border: 0 }}
              frameBorder="0"
              scrolling="no"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
      <Icon className="h-4 w-4 text-maroon" />
      {children}
    </h2>
  )
}

// Compact one-line empty/loading state — deliberately not a large dashed box, so
// sections with nothing to show take minimal vertical space.
function MutedNote({ children }) {
  return <p className="mt-3 text-sm text-gray-400">{children}</p>
}

function PendingWelcome({ profile, firstName }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-maroon">
          Welcome, {profile?.full_name ?? firstName}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pending approval
          </span>
          {profile?.student_id && <span>ID {profile.student_id}</span>}
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-600">
          Your membership is awaiting officer approval. Once an SGA officer
          approves your account, your full dashboard will unlock here.
        </p>
        {profile?.is_candidate_application && (
          <>
            <p className="mt-3 text-gray-600">
              In the meantime, you can choose or update the position you&apos;re
              running for.
            </p>
            <Link
              to="/dashboard/candidacy"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
            >
              <Vote className="h-4 w-4" /> Manage my candidacy
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
