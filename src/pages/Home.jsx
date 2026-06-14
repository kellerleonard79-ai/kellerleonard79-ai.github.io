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
      {/* Solid maroon banner, kept compact. Crest + wordmark lockup. */}
      <section id="home" className="bg-maroon text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-12 text-center sm:px-6 lg:flex-row lg:justify-between lg:gap-10 lg:py-14 lg:text-left lg:px-8">
          {/* Crest medallion */}
          <div className="reveal order-1 shrink-0 lg:order-2">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)] sm:h-36 sm:w-36 lg:h-40 lg:w-40">
              <Crest className="h-24 w-24 object-contain sm:h-28 sm:w-28 lg:h-32 lg:w-32" />
            </div>
          </div>

          {/* Wordmark lockup */}
          <div className="reveal order-2 lg:order-1 lg:flex-1">
            <h1 className="font-display text-4xl font-bold uppercase leading-[0.98] tracking-tight sm:text-5xl lg:text-6xl">
              Pensacola High School
            </h1>
            <p className="mt-3 font-sans text-sm font-semibold uppercase tracking-[0.32em] text-white/80 sm:text-base">
              Student Government Association
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
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
        </div>
      </section>

      {/* ─────────────────── Announcements ─────────────────── */}
      <Announcements />

      {/* ─────────────────── Calendar + Instagram ─────────────────── */}
      {/* Dense two-widget row — minimal chrome, no section heading. */}
      <section id="events" className="border-t border-line bg-mist py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            {/* Instagram feed */}
            <div className="card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="icon-tile-solid h-8 w-8 shrink-0">
                    <Instagram className="h-4 w-4" />
                  </span>
                  <span className="truncate font-display text-base font-bold text-ink">
                    @pensacolahighsga
                  </span>
                </div>
                <a
                  href="https://instagram.com/pensacolahighsga"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary btn-sm shrink-0"
                >
                  Follow
                </a>
              </div>
              <div className="flex-1 p-3">
                {/*
                  SNAPWIDGET — Instagram embed for @pensacolahighsga. Create a free
                  widget at snapwidget.com, then paste its ID into SNAPWIDGET_ID at
                  the top of this file. Until then a styled placeholder shows.
                */}
                {SNAPWIDGET_ID ? (
                  <iframe
                    title="PHS SGA Instagram"
                    src={`https://snapwidget.com/embed/${SNAPWIDGET_ID}`}
                    className="snapwidget-widget h-full w-full"
                    allowTransparency="true"
                    frameBorder="0"
                    scrolling="no"
                    style={{ border: 'none', overflow: 'hidden', width: '100%', height: '100%', minHeight: '380px' }}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square animate-pulse rounded-md bg-tint"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* School calendar */}
            <div className="card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="icon-tile-solid h-8 w-8 shrink-0">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span className="font-display text-base font-bold text-ink">
                    Upcoming Events
                  </span>
                </div>
              </div>
              <div className="flex-1 p-3">
                <iframe
                  title="PHS SGA School Calendar"
                  src={CALENDAR_SRC}
                  className="h-full min-h-[380px] w-full rounded-md"
                  style={{ border: 0 }}
                  frameBorder="0"
                  scrolling="no"
                />
              </div>
            </div>
          </div>

          {/* Compact newsletter strip */}
          <NewsletterSignup />
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
    <div className="card mt-5 flex flex-col items-center gap-3 px-4 py-3.5 sm:flex-row sm:gap-4">
      <div className="flex items-center gap-2.5 sm:shrink-0">
        <span className="icon-tile-solid h-8 w-8 shrink-0">
          <Bell className="h-4 w-4" />
        </span>
        <span className="font-display text-sm font-bold text-ink">
          Get event updates
        </span>
      </div>
      {subscribed ? (
        <div className="flex flex-1 items-center gap-2 text-sm text-ink-soft">
          <Check className="h-4 w-4 shrink-0 text-maroon" />
          You're on the list! Watch your inbox for the next update.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-1 flex-col gap-2.5 sm:flex-row">
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
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary btn-sm shrink-0"
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
      {error && <p className="text-xs text-maroon sm:shrink-0">{error}</p>}
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
    <section id="announcements" className="bg-white py-12 sm:py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="eyebrow justify-center">From the SGA</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
            Announcements
          </h2>
        </div>

        <div className="mt-8 space-y-4">
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
