import { Instagram } from './BrandIcons.jsx'

// Maroon footer: brand lockup on the left, a labeled row of Instagram links on
// the right, and a centered copyright bar beneath a hairline divider.
const instagrams = [
  { label: 'SGA', href: 'https://instagram.com/' },
  { label: 'CO2027', href: 'https://instagram.com/' },
  { label: 'CO2028', href: 'https://instagram.com/' },
  { label: 'CO2029', href: 'https://instagram.com/' },
  { label: 'CO2030', href: 'https://instagram.com/' },
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-maroon text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand lockup */}
          <img
            src="/white-phs-sga-logo.png"
            alt="Pensacola High School Student Government Association"
            className="h-20 w-auto object-contain"
          />

          {/* Instagram links */}
          <div className="flex flex-col items-center gap-4 lg:items-end">
            <h3 className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
              Follow Us
            </h3>
            <div className="flex flex-wrap items-end justify-center gap-5">
              {instagrams.map((ig) => (
                <a
                  key={ig.label}
                  href={ig.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-2"
                  aria-label={`${ig.label} Instagram`}
                >
                  <span className="font-display text-sm font-bold tracking-wide text-white/80 transition group-hover:text-white">
                    {ig.label}
                  </span>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white transition group-hover:bg-white group-hover:text-maroon">
                    <Instagram className="h-6 w-6" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 text-center text-xs text-white/60 sm:flex-row sm:justify-between sm:text-left sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} Pensacola High School Student
            Government Association. All rights reserved.
          </p>
          <nav className="flex items-center gap-5">
            <a
              href="mailto:sga@pensacolahigh.edu"
              className="transition hover:text-white"
            >
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
