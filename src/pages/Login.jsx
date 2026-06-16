import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, LogIn, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/'

  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Arriving here from the email-confirmation link. Supabase's detectSessionInUrl
  // auto-creates a session from the link, but a freshly confirmed account is
  // still `pending` SCI approval, so we clear that stray session and tell them
  // what to do next rather than letting them slip past the approval gate.
  const justConfirmed = params.get('confirmed') === '1'
  useEffect(() => {
    if (justConfirmed) supabase.auth.signOut()
  }, [justConfirmed])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Supabase Auth signs in by email, so resolve the student number first.
    const { data: email, error: lookupError } = await supabase.rpc(
      'email_for_student_id',
      { p_student_id: studentId.trim() },
    )
    if (lookupError || !email) {
      setSubmitting(false)
      setError('No account found for that student number.')
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    )
    if (signInError) {
      setSubmitting(false)
      // Supabase returns "Email not confirmed" when the link hasn't been clicked
      // yet — translate it into something actionable.
      setError(
        /email not confirmed/i.test(signInError.message)
          ? 'Please confirm your email first — click the link in the confirmation email we sent you (check your spam folder).'
          : signInError.message,
      )
      return
    }

    // Block members whose membership is still awaiting SCI approval.
    const { data: prof } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', data.user.id)
      .maybeSingle()
    if (prof?.status === 'pending') {
      await supabase.auth.signOut()
      setSubmitting(false)
      setError(
        'Your account is awaiting SCI approval. You’ll be able to sign in once an officer approves your membership.',
      )
      return
    }

    setSubmitting(false)
    navigate(redirect, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <section className="flex items-center justify-center bg-gray-50 px-4 py-16 sm:py-24">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <Crest className="h-14 w-14 object-contain" />
            <h1 className="mt-3 font-display text-2xl font-bold text-maroon">
              Member Login
            </h1>
            <p className="text-sm text-gray-500">Sign in to your SGA account.</p>
          </div>

          {justConfirmed && !error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Email confirmed! Your account is now awaiting SCI approval. An
                officer will review it shortly — you can sign in once it&apos;s
                approved.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label htmlFor="studentId" className="block">
            <span className="mb-1.5 block text-sm font-semibold text-maroon">
              Student Number
            </span>
            <input
              id="studentId"
              type="text"
              inputMode="numeric"
              required
              autoComplete="username"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputClass}
              placeholder="e.g. 1234567"
            />
          </label>

          <label htmlFor="password" className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-maroon">
              Password
            </span>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" /> Sign In
              </>
            )}
          </button>

          <p className="mt-5 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/join" className="font-semibold text-maroon hover:underline">
              Join SGA
            </Link>
          </p>
        </form>
      </section>
      <Footer />
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
