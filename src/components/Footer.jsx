import { Instagram } from './BrandIcons.jsx'

// Light footer: maroon brand lockup + crest on the left, a row of labeled
// Instagram links on the right, and a centered copyright bar beneath.
const instagrams = [
  { label: 'SGA', href: 'https://instagram.com/' },
  { label: 'CO2027', href: 'https://instagram.com/' },
  { label: 'CO2028', href: 'https://instagram.com/' },
  { label: 'CO2029', href: 'https://instagram.com/' },
  { label: 'CO2030', href: 'https://instagram.com/' },
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-white text-maroon">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand lockup + crest */}
          <div className="flex items-center gap-4">
            <img
              src="/maroon-phs-sga-logo.png"
              alt="Pensacola High School Student Government Association"
              className="h-16 w-auto object-contain"
            />
            <img
              src="/crest.png"
              alt="PHS crest"
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Instagram links */}
          <div className="flex flex-wrap items-end justify-center gap-6">
            {instagrams.map((ig) => (
              <a
                key={ig.label}
                href={ig.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 text-maroon transition hover:opacity-70"
                aria-label={`${ig.label} Instagram`}
              >
                <span className="font-display text-sm font-bold tracking-wide">
                  {ig.label}
                </span>
                <Instagram className="h-9 w-9" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-maroon/10">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold text-maroon">
            Copyright {new Date().getFullYear()} Pensacola High School Student
            Government Association. All Rights Reserved
            {'  |  '}
            <a href="mailto:sga@pensacolahigh.edu" className="hover:underline">
              Contact
            </a>
            {'  |  '}
            <a href="/#/" className="hover:underline">
              Sitemap
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
