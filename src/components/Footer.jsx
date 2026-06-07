import { useState } from 'react'
import { Bell, Send, Check, Mail, MapPin, Phone } from 'lucide-react'
import { Instagram, Facebook, Youtube } from './BrandIcons.jsx'
import Crest from './Crest.jsx'

const columns = [
  {
    title: 'Quick Links',
    items: ['About SGA', 'Meet the Officers', 'Constitution', 'Meeting Minutes'],
  },
  {
    title: 'Get Involved',
    items: ['Join a Committee', 'Upcoming Events', 'Volunteer', 'Spirit Week'],
  },
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  // Placeholder handler — wire this up to Supabase (e.g. insert into a
  // "newsletter_subscribers" table) when you're ready.
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email) return
    setSubscribed(true)
    setEmail('')
  }

  return (
    <footer id="contact" className="bg-maroon-dark text-white">
      {/* Newsletter band */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 text-gold-light">
                <Bell className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-widest">
                  Stay in the loop
                </span>
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
                The Tiger Times — Student Newsletter
              </h2>
              <p className="mt-2 max-w-md text-white/70">
                Get SGA updates, event reminders, and school news delivered
                straight to your inbox.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full">
              {subscribed ? (
                <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-white/5 px-5 py-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-maroon-dark">
                    <Check className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-white/90">
                    You're on the list! Watch your inbox for the next issue.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@students.pensacola.edu"
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 outline-none transition focus:border-gold focus:bg-white/15"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gold px-6 py-3 font-semibold text-maroon-dark transition hover:bg-gold-light"
                  >
                    Subscribe <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="mt-3 text-xs text-white/50">
                We respect your privacy. Unsubscribe anytime.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <Crest className="h-12 w-12 object-contain" />
              <span className="font-display text-lg font-bold leading-tight">
                Pensacola High
                <br />
                <span className="text-gold">Student Government</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-white/70">
              Representing every Tiger — building leadership, spirit, and
              community.
            </p>
            <div className="mt-5 flex gap-3">
              {[Instagram, Facebook, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#social"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-gold hover:text-maroon-dark"
                  aria-label="Social media link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold-light">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-white/70 transition hover:text-white"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gold-light">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>500 W Maxwell St, Pensacola, FL 32501</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-gold" />
                <span>(850) 555-0100</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-gold" />
                <span>sga@pensacolahigh.edu</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Pensacola High School SGA. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
