import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Send, Check, Loader2, AtSign } from 'lucide-react'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'

// Compact maroon footer organized into four tight columns: brand + contact,
// quick navigation, class Instagram accounts, and an inline newsletter signup.
// A slim bottom bar carries the copyright and legal/contact links.
// Fallback social links used until site_settings.footer_socials loads.
const defaultSocials = [
  { label: "Class of '27", href: 'https://instagram.com/' },
  { label: "Class of '28", href: 'https://instagram.com/' },
  { label: "Class of '29", href: 'https://instagram.com/' },
  { label: "Class of '30", href: 'https://instagram.com/' },
]

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'Join SGA', to: '/join', requiresSignup: true },
  { label: 'Officer Login', to: '/login' },
]

export default function Footer() {
  const { settings } = useSiteSettings()
  const email = settings?.contact_email || 'sga@pensacolahigh.edu'
  const address =
    settings?.contact_address || '500 W Maxwell St, Pensacola, FL 32501'
  const socials =
    Array.isArray(settings?.footer_socials) && settings.footer_socials.length
      ? settings.footer_socials
      : defaultSocials

  return (
    <footer id="contact" className="mt-auto bg-maroon text-white">
      {/* Main grid */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-4 px-6 pb-2 pt-5 sm:px-8 lg:grid-cols-12">
        {/* Brand + contact */}
        <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-4">
          <img
            src="/white-phs-sga-logo.png"
            alt="Pensacola High School Student Government Association"
            className="h-9 w-auto self-start object-contain"
          />
          <div className="flex flex-col gap-1 text-xs text-white/70">
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1.5 transition hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {email}
            </a>
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{address}</span>
            </p>
          </div>
        </div>

        {/* Quick links */}
        <nav className="lg:col-span-2">
          <h2 className="mb-1.5 font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/50">
            Explore
          </h2>
          <ul className="flex flex-col gap-1 text-xs text-white/75">
            {quickLinks
              .filter((l) => !l.requiresSignup || settings?.signup_enabled)
              .map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        {/* Social */}
        <div className="lg:col-span-2">
          <h2 className="mb-1.5 font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/50">
            Follow Us
          </h2>
          <ul className="flex flex-col gap-1 text-xs text-white/75">
            {socials.map((s, i) => (
              <li key={i}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition hover:text-white"
                >
                  <AtSign className="h-3.5 w-3.5 shrink-0 text-white/50" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Newsletter */}
        <div className="col-span-2 lg:col-span-4">
          <h2 className="mb-1.5 font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/50">
            Stay in the Loop
          </h2>
          <FooterNewsletter />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-2 text-center text-[0.7rem] text-white/60 sm:px-8">
          © {new Date().getFullYear()} Pensacola High School Student
          Government Association. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

// Compact maroon-themed newsletter signup. Stores the email in
// newsletter_emails; a unique violation (23505) means they're already
// subscribed, so we treat it as success.
function FooterNewsletter() {
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

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white">
        <Check className="h-3.5 w-3.5 shrink-0" />
        You're on the list!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 sm:flex-row">
      <label htmlFor="footer-email" className="sr-only">
        Email address
      </label>
      <input
        id="footer-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@students.pensacola.edu"
        className="w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs text-white placeholder-white/40 outline-none transition focus:border-white focus:bg-white/15"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-maroon transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            Subscribe <Send className="h-3.5 w-3.5" />
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-200 sm:hidden">{error}</p>}
    </form>
  )
}
