import { useState } from 'react'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

/**
 * Renders the school crest / logo.
 * Uses the admin-uploaded logo (site_settings.logo_url) when one is set;
 * otherwise looks for /crest.png (place the file in the project's `public/`
 * folder). If the image is missing, it falls back to a clean "PHS" monogram so
 * the layout never breaks.
 */
export default function Crest({ className = '' }) {
  const { settings } = useSiteSettings()
  const [failed, setFailed] = useState(false)
  const src = settings?.logo_url || '/crest.png'

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-full bg-maroon font-display font-bold tracking-wide text-white ${className}`}
        aria-label="School crest"
      >
        PHS
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="School crest"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
