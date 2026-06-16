import { Mail, MapPin } from 'lucide-react'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// Compact maroon footer: brand + contact details on the left, a single
// "Follow Us" row of class-account links on the right, and a slim bottom bar.
const socials = [
  { label: 'SGA', href: 'https://instagram.com/' },
  { label: "'27", href: 'https://instagram.com/' },
  { label: "'28", href: 'https://instagram.com/' },
  { label: "'29", href: 'https://instagram.com/' },
  { label: "'30", href: 'https://instagram.com/' },
]

export default function Footer() {
  const { settings } = useSiteSettings()
  const email = settings?.contact_email || 'sga@pensacolahigh.edu'
  const address =
    settings?.contact_address || '500 W Maxwell St, Pensacola, FL 32501'

  return (
    <footer id="contact" className="mt-auto bg-maroon text-white">
      {/* Main row */}
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        {/* Brand + contact */}
        <div className="flex flex-col items-center gap-3 md:items-start">
          <img
            src="/white-phs-sga-logo.png"
            alt="Pensacola High School Student Government Association"
            className="h-12 w-auto object-contain"
          />
          <div className="flex flex-col items-center gap-1 text-sm text-white/70 md:items-start">
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 transition hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {email}
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {address}
            </p>
          </div>
        </div>

        {/* Social */}
        <div className="flex flex-col items-center gap-2.5 md:items-end">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
            Follow Us
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-2.5">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-white/25 px-3.5 py-1 text-sm font-semibold tracking-wide text-white/85 transition hover:border-white hover:bg-white hover:text-maroon"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-6 py-4 text-center text-xs text-white/60 sm:px-8 md:flex-row md:justify-between md:text-left">
          <p>
            © {new Date().getFullYear()} Pensacola High School Student
            Government Association. All rights reserved.
          </p>
          <nav className="flex items-center gap-5">
            <a href={`mailto:${email}`} className="transition hover:text-white">
              Contact
            </a>
            <a href="/#/" className="transition hover:text-white">
              Sitemap
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
