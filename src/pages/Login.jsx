import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password },
    )
    if (signInError) {
      setSubmitting(false)
      setError(signInError.message)
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
    <div className="min-h-screen bg-white">
      <Navbar />
      <section className="flex items-center justify-center bg-mist px-4 py-16 sm:py-24">
        <form
          onSubmit={handleSubmit}
          className="card w-full max-w-md p-8"
        >
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-tint ring-1 ring-maroon/10">
              <Crest className="h-11 w-11 object-contain" />
            </div>
            <span className="eyebrow mt-4">Members Only</span>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              Member Login
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              Sign in to your SGA account.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-maroon/25 bg-tint px-4 py-3 text-sm text-maroon-dark">
              {error}
            </div>
          )}

          <label htmlFor="email" className="block">
            <span className="field-label">Email</span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </label>

          <label htmlFor="password" className="mt-4 block">
            <span className="field-label">Password</span>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-6 w-full py-3"
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

          <p className="mt-5 text-center text-sm text-ink-mute">
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
