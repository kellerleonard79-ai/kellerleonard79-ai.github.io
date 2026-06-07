import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { formatDate, formatTime, gradeLabel } from '../lib/format.js'

// Two entry points share one view:
//   /dashboard/profile          -> a member's own profile (any clearance)
//   /dashboard/members/:id      -> staff viewing another member's profile
export default function Profile() {
  const { id } = useParams()
  if (id) {
    return (
      <RequireStaff>
        <ProfileContent profileId={id} backTo="/dashboard/members" backLabel="Directory" />
      </RequireStaff>
    )
  }
  return (
    <RequireAuth>
      <OwnProfile />
    </RequireAuth>
  )
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

function ProfileContent({ profileId, backTo, backLabel }) {
  const [profile, setProfile] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).maybeSingle(),
      supabase
        .from('attendance')
        .select('status, checked_in_at, meetings(title, date)')
        .eq('profile_id', profileId)
        .order('checked_in_at', { ascending: false }),
    ])
    setProfile(p)
    setNotFound(!p)
    setAttendance(a ?? [])
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
            <h1 className="font-display text-3xl font-bold text-gray-900">
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

      {/* Attendance */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-lg font-bold text-gray-900">Attendance</h2>

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
                  <p className="truncate font-medium text-gray-900">
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
    </Shell>
  )
}

function Field({ label, value, children }) {
  return (
    <div>
      <dt className="text-sm text-gray-400">{label}</dt>
      <dd className="mt-1 text-gray-900">
        {children ?? (value ? value : <span className="text-gray-400">—</span>)}
      </dd>
    </div>
  )
}

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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <div className="mt-4">{children}</div>
      </div>
      <Footer />
    </div>
  )
}
