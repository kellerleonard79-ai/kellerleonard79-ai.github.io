import { Mail, MapPin } from 'lucide-react'
import { Instagram, Facebook, Youtube } from './BrandIcons.jsx'

// A deliberately simple footer: brand + a couple of essentials, contact, and a
// clean bottom bar. Newsletter signup lives on the homepage, so it isn't
// duplicated here.
const quickLinks = [
  { label: 'About', href: '/#/about' },
  { label: 'Join SGA', href: '/#/join' },
  { label: 'Member Login', href: '/#/login' },
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-maroon text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-sm">
            <div className="flex items-center">
              <img
                src="/white-phs-sga-logo.png"
                alt="PHS SGA logo"
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="mt-5 flex gap-3">
              {[Instagram, Facebook, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#social"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white hover:text-maroon"
                  aria-label="Social media link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <nav className="flex flex-col gap-3">
            <h3 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Explore
            </h3>
            {quickLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-white/70 transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              Contact
            </h3>
            <a
              href="mailto:sga@pensacolahigh.edu"
              className="flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0" />
              sga@pensacolahigh.edu
            </a>
            <p className="flex items-start gap-2 text-sm text-white/70">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              500 W Maxwell St, Pensacola, FL 32501
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/50 sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} Pensacola High School SGA. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
