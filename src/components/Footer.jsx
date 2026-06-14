import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// A single compact footer line: copyright on the left, Instagram text links on
// the right. Newsletter signup lives on the homepage, so it isn't duplicated.
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
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-center sm:flex-row sm:gap-6 sm:px-6 sm:text-left lg:px-8">
        <p className="text-xs text-white/55">
          © {new Date().getFullYear()} Pensacola High School SGA. All rights
          reserved.
        </p>

        {accounts.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            {accounts.map((a, i) => (
              <a
                key={i}
                href={`https://instagram.com/${a.handle.trim().replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-white/75 transition hover:text-white"
              >
                {a.label || `@${a.handle.trim().replace(/^@/, '')}`}
              </a>
            ))}
          </nav>
        )}
      </div>
    </footer>
  )
}
