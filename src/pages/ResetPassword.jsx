import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'

// Landing page for the password-reset email link. The recovery token in the URL
// is consumed by the primary client's detectSessionInUrl, which creates a
// short-lived recovery session and fires a PASSWORD_RECOVERY auth event — that
// session is what authorizes updateUser({ password }) below.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [linkValid, setLinkValid] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true

    // The recovery session may land either before this component mounts (already
    // in the session) or moments after (via the PASSWORD_RECOVERY event), so
    // check both. If neither yields a session the link is invalid/expired.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY' || session) {
          setLinkValid(true)
          setReady(true)
        }
      },
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) {
        setReady(true)
      } else {
        // Give the URL-token exchange a beat to fire its event before deciding
        // the link is bad — otherwise a valid link flashes the error first.
        setTimeout(() => {
          if (active && !ready) {
            setLinkValid(false)
            setReady(true)
          }
        }, 1500)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setSubmitting(false)
      setError(updateError.message)
      return
    }
    // Drop the recovery session so they sign back in normally by student number.
    await supabase.auth.signOut()
    setSubmitting(false)
    setDone(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <section className="flex items-center justify-center bg-gray-50 px-4 py-16 sm:py-24">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Crest className="h-14 w-14 object-contain" />
            <h1 className="mt-3 font-display text-2xl font-bold text-maroon">
              Reset Password
            </h1>
            <p className="text-sm text-gray-500">Choose a new password for your account.</p>
          </div>

          {!ready ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Verifying your link…
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-left text-sm text-green-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Your password has been updated. You can now sign in with your new password.</span>
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
              >
                Go to Sign In
              </button>
            </div>
          ) : !linkValid ? (
            <div className="text-center">
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                This password reset link is invalid or has expired. Request a new
                one from the sign-in page.
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <label htmlFor="password" className="block">
                <span className="mb-1.5 block text-sm font-semibold text-maroon">
                  New Password
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </label>

              <label htmlFor="confirm" className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-maroon">
                  Confirm New Password
                </span>
                <input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                    <Loader2 className="h-5 w-5 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5" /> Update Password
                  </>
                )}
              </button>
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
