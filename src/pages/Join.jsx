import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, UserPlus } from 'lucide-react'
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
  is_candidate_application: false,
}

export default function Join() {
  const { settings, loading: settingsLoading } = useSiteSettings()
  const [form, setForm] = useState(EMPTY)
  // Values for the admin-configured schema fields, keyed by field.key.
  const [extra, setExtra] = useState({})
  const [status, setStatus] = useState('idle') // idle | submitting | success
  const [error, setError] = useState('')

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
        // These land in raw_user_meta_data and are copied into `profiles`
        // by the handle_new_user() trigger on signup.
        data: {
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim(),
          grade_level: extra.grade ?? '',
          shirt_size: extra.shirt_size ?? '',
          is_candidate_application: form.is_candidate_application,
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

  // Signup is gated by site_settings.signup_enabled. While settings load, show
  // a spinner; if signup is explicitly disabled, redirect home.
  if (settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-maroon" />
      </div>
    )
  }
  if (settings && settings.signup_enabled === false) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative overflow-hidden bg-maroon py-14 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_100%_120%,rgba(0,0,0,0.35),transparent_55%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
            Home of the Tigers
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Join SGA
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/70">
            Become a member of Pensacola High School Student Government. Fill out
            the form below to create your account.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-mist py-12 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          {status === 'success' ? (
            <div className="card p-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-maroon text-white">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-ink">
                Registration received!
              </h2>
              <p className="mt-2 text-ink-soft">
                Confirm your email address, then an SGA officer will review your
                membership. You&apos;ll be able to log in once your account is
                approved.
              </p>
              <Link to="/" className="btn-primary mt-6">
                <ArrowLeft className="h-5 w-5" /> Back to Home
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3 border-b border-line pb-5">
                <Crest className="h-12 w-12 shrink-0 object-contain" />
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Member Registration
                  </h2>
                  <p className="text-sm text-ink-mute">
                    All fields are required.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-5 rounded-lg border border-maroon/25 bg-tint px-4 py-3 text-sm text-maroon-dark">
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

                <hr className="hr-line" />

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

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-mist p-4">
                  <input
                    type="checkbox"
                    checked={form.is_candidate_application}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_candidate_application: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-line-strong accent-maroon focus:ring-maroon/30"
                  />
                  <span className="text-sm text-ink-soft">
                    <span className="font-semibold text-ink">
                      I&apos;m running for a position
                    </span>
                    <span className="mt-0.5 block text-ink-mute">
                      Check this if you&apos;re applying as a candidate, not just
                      a general member. An officer will follow up about your
                      candidacy.
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary mt-7 w-full py-3"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Creating
                    account…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" /> Create Account
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-sm text-ink-mute">
                <Link to="/" className="font-semibold text-maroon hover:underline">
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

const inputClass = 'input'

// Renders a single schema-driven field (Grade, Shirt Size, or any admin-added
// custom field). Checkbox fields render inline; text/select use the Field shell.
function DynamicField({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          required={field.required}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong accent-maroon focus:ring-maroon/30"
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
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
