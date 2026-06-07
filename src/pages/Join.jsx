import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'

const GRADE_LEVELS = [9, 10, 11, 12]
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const EMPTY = {
  full_name: '',
  student_id: '',
  grade_level: '',
  shirt_size: '',
  email: '',
  password: '',
}

export default function Join() {
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | submitting | success
  const [error, setError] = useState('')

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('submitting')

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // These land in raw_user_meta_data and are copied into `profiles`
        // by the handle_new_user() trigger on signup.
        data: {
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim(),
          grade_level: form.grade_level,
          shirt_size: form.shirt_size,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setStatus('idle')
      return
    }

    setStatus('success')
    setForm(EMPTY)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-dark py-14 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,162,74,0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-light">
            Home of the Tigers
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold sm:text-5xl">
            Join <span className="text-gold">SGA</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/80">
            Become a member of Pensacola High School Student Government. Fill out
            the form below to create your account.
          </p>
        </div>
        <div className="absolute bottom-0 h-1.5 w-full bg-gradient-to-r from-gold via-gold-light to-gold" />
      </section>

      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          {status === 'success' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
              <h2 className="mt-4 font-display text-2xl font-bold text-maroon">
                You&apos;re registered!
              </h2>
              <p className="mt-2 text-gray-600">
                Check your email to confirm your account. Once confirmed, you can
                log in as an SGA member.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white transition hover:bg-maroon-dark"
              >
                <ArrowLeft className="h-5 w-5" /> Back to Home
              </Link>
            </div>
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
                  <p className="text-sm text-gray-500">
                    All fields are required.
                  </p>
                </div>
              </div>

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

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Grade Level" htmlFor="grade_level">
                    <select
                      id="grade_level"
                      required
                      value={form.grade_level}
                      onChange={update('grade_level')}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {GRADE_LEVELS.map((g) => (
                        <option key={g} value={g}>
                          {g}th Grade
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Shirt Size" htmlFor="shirt_size">
                    <select
                      id="shirt_size"
                      required
                      value={form.shirt_size}
                      onChange={update('shirt_size')}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {SHIRT_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

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
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 font-semibold text-maroon-dark shadow-lg transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
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
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function Field({ label, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </span>
      {children}
    </label>
  )
}
