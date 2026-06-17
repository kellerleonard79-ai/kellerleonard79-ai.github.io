import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import {
  measureClockSkew,
  getSkewMs,
  CLOCK_SKEW_THRESHOLD_MS,
} from '../lib/clockCheck.js'

// Non-blocking banner shown when the device clock is far enough off to threaten
// Supabase auth. The storage wrapper in supabaseClient compensates for the skew
// so the site keeps working, but a wildly wrong clock can still cause trouble
// (and is worth fixing), so we surface a dismissible heads-up instead of letting
// the cause stay invisible. Deliberately not a full-screen blocker — public
// pages must stay usable.
export default function ClockWarning() {
  const [skewMs, setSkewMs] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let active = true
    measureClockSkew().then(() => {
      if (active) setSkewMs(getSkewMs())
    })
    return () => {
      active = false
    }
  }, [])

  if (skewMs == null || Math.abs(skewMs) < CLOCK_SKEW_THRESHOLD_MS) return null
  if (dismissed) return null

  const ahead = skewMs > 0
  const off = describeOffset(Math.abs(skewMs))

  return (
    <div className="sticky top-0 z-[9999] flex items-start gap-3 bg-maroon px-4 py-2.5 text-sm text-white">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
      <p className="flex-1 leading-snug">
        <strong>Your device's clock looks wrong</strong> — about {off}{' '}
        {ahead ? 'ahead of' : 'behind'} the correct time. Sign-in and some
        features may misbehave. Turn on automatic date &amp; time (and time zone)
        in your device settings, then{' '}
        <button
          onClick={() => window.location.reload()}
          className="underline underline-offset-2 hover:opacity-80"
        >
          reload
        </button>
        .
      </p>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-white/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function describeOffset(ms) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
