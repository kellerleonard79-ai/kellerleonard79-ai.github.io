import { useState } from 'react'

/**
 * Renders the official Pensacola High School crest.
 * Looks for the image at /crest.png (place the file in the project's `public/` folder).
 * If the image is missing, it falls back to a clean "PHS" monogram so the layout never breaks.
 */
export default function Crest({ className = '' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-full bg-maroon font-display font-bold text-gold ${className}`}
        aria-label="Pensacola High School crest"
      >
        PHS
      </div>
    )
  }

  return (
    <img
      src="/crest.png"
      alt="Pensacola High School crest"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
