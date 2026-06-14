import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Megaphone, Bell, Send, Check, Loader2, ArrowRight } from 'lucide-react'
import { Instagram } from '../components/BrandIcons.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
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
      <section id="home" className="relative overflow-hidden bg-maroon text-white">
        {/* Atmosphere: soft highlights + oversized crest watermark */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(0,0,0,0.35),transparent_50%)]" />
        <div className="pointer-events-none absolute -left-16 -bottom-24 opacity-[0.06]">
          <Crest className="h-[26rem] w-[26rem] object-contain" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:justify-between lg:py-20 lg:px-8">
          {/* Wordmark lockup */}
          <div className="reveal w-full text-center lg:flex-1 lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
              Home of the Tigers
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-[5.2rem]">
              Pensacola
              <br />
              High School
            </h1>
            <div className="mx-auto mt-6 h-px w-44 bg-white/30 lg:mx-0" />
            <p className="mt-6 font-sans text-base font-semibold uppercase tracking-[0.28em] text-white/80 sm:text-lg">
              Student Government Association
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                to="/about"
                className="btn bg-white text-maroon shadow-sm hover:bg-mist-deep"
              >
                Meet the Officers <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/join"
                className="btn border border-white/40 text-white hover:bg-white/10"
              >
                Join SGA
              </Link>
            </div>
          </div>

          {/* Crest medallion */}
          <div className="reveal shrink-0" style={{ animationDelay: '120ms' }}>
            <div className="relative grid place-items-center">
              <div className="absolute inset-0 -m-3 rounded-full border border-white/15" />
              <div className="grid h-56 w-56 place-items-center rounded-full bg-white/95 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:h-64 sm:w-64 lg:h-72 lg:w-72">
                <Crest className="h-40 w-40 object-contain sm:h-44 sm:w-44 lg:h-52 lg:w-52" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── Announcements ─────────────────── */}
      <Announcements />

      {/* ─────────────────── Stay Connected grid ─────────────────── */}
      <section id="events" className="border-t border-line bg-mist py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow justify-center">Stay Connected</span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
              What's New
            </h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Follow our latest posts and never miss a school event.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
            {/* Left — newsletter signup + school calendar */}
            <div className="flex flex-col gap-6">
              <NewsletterSignup />

              {/* School calendar */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line p-5">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile-solid h-10 w-10">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      Upcoming Events
                    </h3>
                  </div>
                  <a href="#calendar" className="btn-outline btn-sm">
                    Full View
                  </a>
                </div>
                <div className="p-5">
                  <iframe
                    title="PHS SGA School Calendar"
                    src={CALENDAR_SRC}
                    className="w-full rounded-lg"
                    style={{ border: 0 }}
                    height="450"
                    frameBorder="0"
                    scrolling="no"
                  />
                </div>
              </div>
            </div>

            {/* Right — Instagram feed */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line p-5">
                <div className="flex items-center gap-3">
                  <span className="icon-tile-solid h-10 w-10">
                    <Instagram className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      Follow Our Instagram
                    </h3>
                    <p className="text-sm text-ink-mute">@pensacolahighsga</p>
                  </div>
                </div>
                <a
                  href="https://instagram.com/pensacolahighsga"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary btn-sm"
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
                          className="aspect-square animate-pulse rounded-lg bg-tint"
                        />
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg border border-dashed border-line-strong p-4 text-center text-sm text-ink-mute">
                      Instagram feed loads once a SnapWidget ID is set — see the
                      setup note in <code>Home.jsx</code>.
                    </div>
                  </>
                )}
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
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <span className="icon-tile-solid h-10 w-10 shrink-0">
          <Bell className="h-5 w-5" />
        </span>
        <h3 className="font-display text-lg font-semibold text-ink">
          Get Updates About Upcoming Events
        </h3>
      </div>
      <div className="p-5">
        {subscribed ? (
          <div className="flex items-center gap-3 rounded-lg border border-maroon/20 bg-tint px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-maroon text-white">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink-soft">
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
              className="input"
            />
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary shrink-0"
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
        {error && <p className="mt-3 text-xs text-maroon">{error}</p>}
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
    <section id="announcements" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="eyebrow justify-center">From the SGA</span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
            Announcements
          </h2>
        </div>

        <div className="mt-10 space-y-4">
          {items.map((a) => (
            <article key={a.id} className="card-pad">
              <div className="flex items-start gap-4">
                <span className="icon-tile h-11 w-11 shrink-0">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {a.title}
                    </h3>
                    <span className="text-xs text-ink-mute">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {a.body && (
                    <p className="mt-2 whitespace-pre-line text-ink-soft">
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
