// Maroon footer: brand lockup on the left, a single "Follow Us" label with
// pill-shaped text links on the right, and a divided bottom bar beneath.
const socials = [
  { label: 'SGA', href: 'https://instagram.com/' },
  { label: "'27", href: 'https://instagram.com/' },
  { label: "'28", href: 'https://instagram.com/' },
  { label: "'29", href: 'https://instagram.com/' },
  { label: "'30", href: 'https://instagram.com/' },
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-maroon text-white">
      {/* Main row */}
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand */}
        <img
          src="/white-phs-sga-logo.png"
          alt="Pensacola High School Student Government Association"
          className="h-20 w-auto object-contain"
        />

        {/* Social */}
        <div className="flex flex-col items-center gap-4 lg:items-end">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
            Follow Us
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-white/25 px-4 py-1.5 text-sm font-semibold tracking-wide text-white/85 transition hover:border-white hover:bg-white hover:text-maroon"
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
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-6 text-center text-sm text-white/60 sm:px-8 md:flex-row md:justify-between md:text-left">
          <p>
            © {new Date().getFullYear()} Pensacola High School Student
            Government Association. All rights reserved.
          </p>
          <nav className="flex items-center gap-6">
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
