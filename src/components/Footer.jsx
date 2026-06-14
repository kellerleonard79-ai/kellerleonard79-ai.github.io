import { Mail, MapPin } from 'lucide-react'
import { Instagram } from './BrandIcons.jsx'
import Crest from './Crest.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// A deliberately simple footer: brand + a couple of essentials, contact, and a
// clean bottom bar. Newsletter signup lives on the homepage, so it isn't
// duplicated here.
const quickLinks = [
  { label: 'About', href: '/#/about' },
  { label: 'Join SGA', href: '/#/join' },
  { label: 'Member Login', href: '/#/login' },
]

export default function Footer() {
  const { settings } = useSiteSettings()
  // Admin-managed Instagram accounts (Admin Settings → General). Only entries
  // with a handle are linkable, so skip the rest.
  const accounts = Array.isArray(settings?.instagram_accounts)
    ? settings.instagram_accounts.filter((a) => a?.handle?.trim())
    : []

  return (
    <footer id="contact" className="bg-maroon-deep text-white">
      <div className="h-[3px] w-full bg-maroon-light" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Crest className="h-11 w-11 object-contain" />
              <span className="font-display text-base font-semibold uppercase leading-tight tracking-wide">
                Pensacola High
                <br />
                Student Government
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Representing every Tiger — building leadership, spirit, and
              community.
            </p>
          </div>

          {/* Quick links */}
          <nav className="flex flex-col gap-3">
            <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
              Explore
            </h3>
            {quickLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="w-fit text-sm text-white/75 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
              Contact
            </h3>
            <a
              href="mailto:sga@pensacolahigh.edu"
              className="flex items-center gap-2 text-sm text-white/75 transition hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0" />
              sga@pensacolahigh.edu
            </a>
            <p className="flex items-start gap-2 text-sm text-white/75">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              500 W Maxwell St, Pensacola, FL 32501
            </p>
          </div>
        </div>

        {/* Instagram accounts row */}
        {accounts.length > 0 && (
          <div className="mt-12 border-t border-white/10 pt-10">
            <h3 className="text-center font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
              Follow Our Instagrams
            </h3>
            <div className="mt-6 flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
              {accounts.map((a, i) => (
                <a
                  key={i}
                  href={`https://instagram.com/${a.handle.trim().replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col items-center gap-2"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 text-white transition group-hover:bg-white group-hover:text-maroon">
                    <Instagram className="h-6 w-6" />
                  </span>
                  {a.label && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/70 transition group-hover:text-white">
                      {a.label}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/45 sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} Pensacola High School SGA. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
