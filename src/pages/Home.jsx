import { ArrowRight, CalendarDays } from 'lucide-react'
import { Instagram } from '../components/BrandIcons.jsx'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        id="home"
        className="relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-dark text-white"
      >
        {/* decorative crest watermark */}
        <div className="pointer-events-none absolute -right-20 top-1/2 hidden -translate-y-1/2 opacity-10 lg:block">
          <Crest className="h-[34rem] w-[34rem] object-contain" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,162,74,0.18),transparent_42%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-light">
              Home of the Tigers
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Pensacola High School{' '}
              <span className="text-gold">Student Government</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Representing every Tiger. Building school spirit, leadership, and
              community — one event, one voice, one student at a time.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#get-involved"
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 font-semibold text-maroon-dark shadow-lg transition hover:bg-gold-light"
              >
                Get Involved <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#events"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                <CalendarDays className="h-5 w-5" /> Upcoming Events
              </a>
            </div>
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="relative">
              <div className="absolute inset-0 scale-110 rounded-full bg-gold/20 blur-3xl" />
              <Crest className="relative h-80 w-80 object-contain drop-shadow-2xl" />
            </div>
          </div>
        </div>

        {/* gold divider */}
        <div className="h-1.5 w-full bg-gradient-to-r from-gold via-gold-light to-gold" />
      </section>

      {/* ─────────────────── Stay Connected grid ─────────────────── */}
      <section id="events" className="bg-gray-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-maroon sm:text-4xl">
              Stay Connected
            </h2>
            <p className="mt-3 text-gray-600">
              Follow our latest posts and never miss a school event.
            </p>
            <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gold" />
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Left — Instagram feed placeholder */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#962fbf] text-white">
                    <Instagram className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-gray-900">
                      Instagram Feed
                    </h3>
                    <p className="text-sm text-gray-500">@phs_sga</p>
                  </div>
                </div>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark"
                >
                  Follow
                </a>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-lg bg-gray-100"
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                  {/* Instagram Feed Widget — drop your embed here
                      (e.g. Behold, LightWidget, or EmbedSocial). */}
                  Instagram Feed Widget — embed goes here.
                </div>
              </div>
            </div>

            {/* Right — School calendar placeholder */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-maroon text-gold">
                    <CalendarDays className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-gray-900">
                      School Calendar
                    </h3>
                    <p className="text-sm text-gray-500">
                      Events, meetings &amp; deadlines
                    </p>
                  </div>
                </div>
                <a
                  href="#calendar"
                  className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
                >
                  Full View
                </a>
              </div>
              <div className="p-5">
                {/* Calendar placeholder — paste your Google Calendar
                    <iframe> here to embed the live school calendar. */}
                <div className="flex min-h-[18rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                  <CalendarDays className="h-10 w-10 text-maroon/40" />
                  <p className="mt-3 font-semibold text-gray-700">
                    Embedded Calendar Coming Soon
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-gray-500">
                    Paste your Google Calendar embed code here to show upcoming
                    SGA and school events.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
