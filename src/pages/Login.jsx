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

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label htmlFor="email" className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Email
            </span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </label>

          <label htmlFor="password" className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
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
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
