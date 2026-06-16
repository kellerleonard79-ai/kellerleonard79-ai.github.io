import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  UserPlus,
  Vote,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

const EMPTY = {
  full_name: '',
  student_id: '',
  email: '',
  password: '',
}

export default function Join() {
  const { settings, loading: settingsLoading } = useSiteSettings()
  const [form, setForm] = useState(EMPTY)
  // Values for the admin-configured schema fields, keyed by field.key.
  const [extra, setExtra] = useState({})
  const [status, setStatus] = useState('idle') // idle | submitting | success
  const [error, setError] = useState('')
  // Whether an election cycle is currently open. When it is, the applicant first
  // chooses between running for a position and joining as a general member.
  // election_cycles isn't readable by anon, so we ask a public SECURITY DEFINER
  // function for just the boolean. null = still checking.
  const [candidacyOpen, setCandidacyOpen] = useState(null)
  // Which path the applicant picked while a cycle is open: '' (still choosing),
  // 'member', or 'candidate'. Ignored when no cycle is open (always 'member').
  const [mode, setMode] = useState('')

  useEffect(() => {
    let active = true
    supabase.rpc('candidate_applications_open').then(({ data }) => {
      if (active) setCandidacyOpen(data === true)
    })
    return () => {
      active = false
    }
  }, [])

  // The dynamic part of the form is driven entirely by join_form_schema; fields
  // toggled off (enabled === false) are skipped.
  const schema = Array.isArray(settings?.join_form_schema)
    ? settings.join_form_schema.filter((f) => f.enabled !== false)
    : []

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const updateExtra = (key, value) =>
    setExtra((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('submitting')

    // The default Grade / Shirt Size fields map onto dedicated profile columns;
    // everything flagged `custom` is collected into the custom_fields jsonb.
    const customFields = {}
    for (const f of schema) {
      if (f.custom) customFields[f.key] = extra[f.key] ?? ''
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // Where the email-confirmation link sends them back to. Without this,
        // Supabase falls back to the project's Site URL (localhost) and the
        // link lands on a blank page. Must also be in the dashboard's redirect
        // allow-list. We send confirmed users to login with a banner since the
        // account still needs SCI approval before it can be used.
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        // These land in raw_user_meta_data and are copied into `profiles`
        // by the handle_new_user() trigger on signup.
        data: {
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim(),
          grade_level: extra.grade ?? '',
          shirt_size: extra.shirt_size ?? '',
          // This form is the general-member path. The elected-position
          // application is a separate flow (built next).
          is_candidate_application: false,
          custom_fields: JSON.stringify(customFields),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setStatus('idle')
      return
    }

    // New members start as 'pending' and need SCI approval before they can log
    // in. If email confirmation is disabled, signUp returns an active session —
    // sign it out so a pending account can't bypass the login approval gate.
    await supabase.auth.signOut()

    setStatus('success')
    setForm(EMPTY)
    setExtra({})
  }

  // Signup is gated by site_settings.signup_enabled. While settings (or the
  // cycle check) load, show a spinner; if signup is explicitly disabled,
  // redirect home.
  if (settingsLoading || candidacyOpen === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-maroon" />
      </div>
    )
  }
  if (settings && settings.signup_enabled === false) {
    return <Navigate to="/" replace />
  }

  // With a cycle open the applicant picks a path first; otherwise everyone takes
  // the general-member form directly.
  const choosing = candidacyOpen && mode === ''
  const showCandidate = candidacyOpen && mode === 'candidate'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <JoinHero settings={settings} />

      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          {status === 'success' ? (
            <SuccessCard />
          ) : choosing ? (
            <ChoiceScreen onChoose={setMode} />
          ) : showCandidate ? (
            <CandidateSkeleton onBack={() => setMode('')} />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="mb-6 flex items-center gap-3">
                <Crest className="h-12 w-12 shrink-0 object-contain" />
                <div>
                  <h2 className="font-display text-xl font-bold text-maroon">
                    Member Registration
                  </h2>
                  <p className="text-sm text-gray-500">All fields are required.</p>
                </div>
              </div>

              {/* When a cycle is open, let them step back to the path chooser. */}
              {candidacyOpen && (
                <button
                  type="button"
                  onClick={() => setMode('')}
                  className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-maroon"
                >
                  <ArrowLeft className="h-4 w-4" /> Choose a different application
                </button>
              )}

              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-5">
                <Field label="Full Name" htmlFor="full_name">
                  <input
                    id="full_name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.full_name}
                    onChange={update('full_name')}
                    className={inputClass}
                    placeholder="Jordan Tiger"
                  />
                </Field>

                <Field label="Student ID" htmlFor="student_id">
                  <input
                    id="student_id"
                    type="text"
                    required
                    value={form.student_id}
                    onChange={update('student_id')}
                    className={inputClass}
                    placeholder="1234567"
                  />
                </Field>

                {schema.map((field) => (
                  <DynamicField
                    key={field.key}
                    field={field}
                    value={extra[field.key] ?? (field.type === 'checkbox' ? false : '')}
                    onChange={(v) => updateExtra(field.key, v)}
                  />
                ))}

                <hr className="border-gray-100" />

                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={update('email')}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </Field>

                <Field label="Password" htmlFor="password">
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={update('password')}
                    className={inputClass}
                    placeholder="At least 6 characters"
                  />
                </Field>
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" /> Create Account
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-sm text-gray-500">
                <Link to="/" className="font-medium text-maroon hover:underline">
                  ← Back to Home
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function JoinHero({ settings }) {
  return (
    <section className="relative overflow-hidden bg-maroon py-14 text-white sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_45%)]" />
      <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          Home of the Tigers
        </span>
        <h1 className="mt-5 font-display text-4xl font-semibold uppercase tracking-wide sm:text-5xl">
          Join SGA
        </h1>
        <p className="mx-auto mt-4 max-w-md text-white/75">
          Become a member of Pensacola High School Student Government. Fill out
          the form below to create your account.
        </p>
        {settings?.constitution_url && (
          <a
            href={settings.constitution_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <FileText className="h-4 w-4" /> Read the SGA Constitution
          </a>
        )}
      </div>
      <div className="absolute bottom-0 h-1 w-full bg-white/15" />
    </section>
  )
}

// Shown only while an election cycle is open: the applicant first picks whether
// they're running for office or joining as a general member.
function ChoiceScreen({ onChoose }) {
  return (
    <div>
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-maroon">
          <Vote className="h-3.5 w-3.5" /> Elections are open
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold text-maroon">
          How would you like to apply?
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose the application that fits you.
        </p>
      </div>

      <div className="grid gap-4">
        <ChoiceCard
          icon={Vote}
          title="Apply for an Elected Position"
          desc="Run for office this election cycle."
          onClick={() => onChoose('candidate')}
        />
        <ChoiceCard
          icon={UserPlus}
          title="Apply as a General Member"
          desc="Join SGA without running for a position."
          onClick={() => onChoose('member')}
        />
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link to="/" className="font-medium text-maroon hover:underline">
          ← Back to Home
        </Link>
      </p>
    </div>
  )
}

function ChoiceCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-maroon/30 hover:shadow-md"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon/8 text-maroon transition-colors group-hover:bg-maroon group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-bold text-maroon">
          {title}
        </span>
        <span className="block text-sm text-gray-500">{desc}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-maroon" />
    </button>
  )
}

// The elected-position path is a multi-step checklist that lives behind login
// (it tracks uploads, agreements and interview bookings). So here we explain the
// two-step flow: create an account first, then complete the checklist. New
// applicants create their account below; returning ones sign in.
function CandidateSkeleton({ onBack }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-maroon"
      >
        <ArrowLeft className="h-4 w-4" /> Choose a different application
      </button>

      <Vote className="mx-auto h-14 w-14 text-maroon/70" />
      <h2 className="mt-4 font-display text-2xl font-bold text-maroon">
        Run for an Elected Position
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-gray-600">
        Running for office is a guided checklist — choose your position, agree to
        the rules, upload endorsements and book an interview. First create your
        member account, then you&apos;ll be taken to your application dashboard.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-maroon px-5 py-2.5 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
        >
          I already have an account
        </Link>
        <Link
          to="/dashboard/application"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
        >
          <ArrowRight className="h-4 w-4" /> Go to my application
        </Link>
      </div>
    </div>
  )
}

function SuccessCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
      <h2 className="mt-4 font-display text-2xl font-bold text-maroon">
        Registration received!
      </h2>
      <p className="mt-2 text-gray-600">
        <span className="font-semibold text-maroon">
          Check your inbox and click the confirmation link
        </span>{' '}
        we just emailed you. After that, an SGA officer will review your
        membership — you&apos;ll be able to log in once your account is confirmed{' '}
        <em>and</em> approved. (Be sure to check your spam folder.)
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white transition hover:bg-maroon-dark"
      >
        <ArrowLeft className="h-5 w-5" /> Back to Home
      </Link>
    </div>
  )
}

// Renders a single schema-driven field (Grade, Shirt Size, or any admin-added
// custom field). Checkbox fields render inline; text/select use the Field shell.
function DynamicField({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-maroon">
        <input
          type="checkbox"
          required={field.required}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30"
        />
        {field.label}
      </label>
    )
  }

  return (
    <Field label={field.label} htmlFor={field.key}>
      {field.type === 'select' ? (
        <select
          id={field.key}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={field.key}
          type="text"
          required={field.required}
          placeholder={field.placeholder ?? ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </Field>
  )
}

function Field({ label, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-maroon">
        {label}
      </span>
      {children}
    </label>
  )
}
