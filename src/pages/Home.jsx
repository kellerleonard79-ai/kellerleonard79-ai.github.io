import { useEffect, useState } from 'react'
import { CalendarDays, Megaphone, Bell, Send, Check, Loader2 } from 'lucide-react'
import { Instagram } from '../components/BrandIcons.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import supabase from '../lib/supabaseClient.js'

// ── Embeds ──────────────────────────────────────────────────────────────────
// SnapWidget Instagram widget ID. Once a widget is created (see the SNAPWIDGET
// note in index.html), paste only the ID here — e.g. SNAPWIDGET_ID = '123456'.
// While blank, a styled fallback with setup instructions shows instead.
const SNAPWIDGET_ID = ''

// PHS SGA public Google Calendar (same embed as the original Django site).
const CALENDAR_SRC =
  'https://calendar.google.com/calendar/embed?src=c_0660093bc692b20cf903cc9ebe8c8a7ab767b99fcd4a467cc5b55193b1926b40%40group.calendar.google.com&ctz=America%2FChicago&mode=AGENDA'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        id="home"
        className="relative overflow-hidden bg-maroon text-white"
      >
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-8 text-center sm:px-6 lg:px-8 lg:py-10">
          {/* Masthead — full wordmark + crest lockup */}
          <img
            src="/masthead.png"
            alt="Pensacola High School Student Government Association"
            className="w-full max-w-3xl object-contain drop-shadow-2xl"
          />
        </div>

        {/* clean white baseline divider */}
        <div className="h-1 w-full bg-white/15" />
      </section>

      {/* ─────────────────── Announcements ─────────────────── */}
      <Announcements />

      {/* ─────────────────── Stay Connected grid ─────────────────── */}
      <section id="events" className="bg-gray-50 pt-4 pb-12 sm:pt-6 sm:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-maroon sm:text-4xl">
              What's New
            </h2>
            <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-maroon" />
          </div>

          <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-2">
            {/* Left — newsletter signup + Instagram feed */}
            <div className="flex flex-col gap-8">
              <NewsletterSignup />

              {/* Instagram feed placeholder */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf] text-white">
                      <Instagram className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-maroon">
                        Follow Our Instagrams!
                      </h3>
                      <p className="text-sm text-gray-500">@pensacolahighsga</p>
                    </div>
                  </div>
                  <a
                    href="https://instagram.com/pensacolahighsga"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark"
                  >
                    Follow
                  </a>
                </div>
                <div className="p-5">
                  {/*
                    SNAPWIDGET — Instagram embed for @pensacolahighsga
                    Setup (one-time, done at snapwidget.com — free, no Meta review):
                      1. Create a free account at https://snapwidget.com.
                      2. Create Widget → Instagram → connect/enter @pensacolahighsga.
                      3. Choose a "Grid" layout, copy the widget ID from the embed
                         code (the number in https://snapwidget.com/embed/NNNNNN).
                      4. Paste that number into SNAPWIDGET_ID at the top of this file.
                    The script tag in index.html makes the iframe auto-resize.
                  */}
                  {SNAPWIDGET_ID ? (
                    <iframe
                      title="PHS SGA Instagram"
                      src={`https://snapwidget.com/embed/${SNAPWIDGET_ID}`}
                      className="snapwidget-widget w-full"
                      allowTransparency="true"
                      frameBorder="0"
                      scrolling="no"
                      style={{ border: 'none', overflow: 'hidden', width: '100%', height: '320px' }}
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="aspect-square animate-pulse rounded-lg bg-gray-100"
                          />
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                        Instagram feed loads once a SnapWidget ID is set — see the
                        setup note in <code>Home.jsx</code>.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right — school calendar (height matches the left column) */}
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-maroon text-white">
                    <CalendarDays className="h-6 w-6" />
                  </span>
                  <h3 className="font-display text-lg font-bold text-maroon">
                    Upcoming Events
                  </h3>
                </div>
                <a
                  href="#calendar"
                  className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
                >
                  Full View
                </a>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <iframe
                  title="PHS SGA School Calendar"
                  src={CALENDAR_SRC}
                  className="min-h-[450px] w-full flex-1 rounded-xl"
                  style={{ border: 0 }}
                  frameBorder="0"
                  scrolling="no"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

// Light-themed newsletter signup card for the "What's New" section. Stores the
// email in newsletter_emails; a duplicate (unique violation, 23505) just means
// they're already on the list, so we treat it as success.
function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setSubmitting(true)
    setError('')
    const { error: insertError } = await supabase
      .from('newsletter_emails')
      .insert({ email: trimmed })
    setSubmitting(false)
    if (insertError && insertError.code !== '23505') {
      setError('Something went wrong. Please try again.')
      return
    }
    setSubscribed(true)
    setEmail('')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon text-white">
          <Bell className="h-6 w-6" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold text-maroon">
            Get Updates About Upcoming Events
          </h3>
        </div>
      </div>
      <div className="p-5">
        {subscribed ? (
          <div className="flex items-center gap-3 rounded-xl border border-maroon/20 bg-maroon/5 px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon text-white">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-sm text-maroon">
              You're on the list! Watch your inbox for the next update.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="events-email" className="sr-only">
              Email address
            </label>
            <input
              id="events-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@students.pensacola.edu"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-maroon placeholder-gray-400 outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-maroon px-6 py-3 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Subscribing…
                </>
              ) : (
                <>
                  Subscribe <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

// Pulls published announcements (RLS lets anon read only published rows) and
// renders them below the hero. Renders nothing when there are none, so the
// homepage stays clean until SCI publishes something.
function Announcements() {
  const [items, setItems] = useState([])

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
  }, [])

  if (items.length === 0) return null

  return (
    <section id="announcements" className="bg-white pt-12 pb-4 sm:pt-16 sm:pb-6">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-maroon sm:text-4xl">
            Announcements
          </h2>
          <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-maroon" />
        </div>

        <div className="mt-10 space-y-4">
          {items.map((a) => (
            <article
              key={a.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-lg font-bold text-maroon">
                      {a.title}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {a.body && (
                    <p className="mt-2 whitespace-pre-line text-gray-600">
                      {a.body}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
