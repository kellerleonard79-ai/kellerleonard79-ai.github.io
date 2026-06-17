import { createClient } from '@supabase/supabase-js'
import { getSkewMs } from './clockCheck.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Decode a JWT's `exp` (seconds since epoch, set by the server) without
// verifying it — we only need the claim to recompute expiry in the device's
// clock frame. Returns null if the token can't be parsed.
function jwtExp(token) {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    )
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

// auth-js judges whether the session is expired with `expires_at*1000 -
// Date.now() < margin`, where `expires_at` is the token's server-set expiry but
// `Date.now()` is the (possibly wrong) device clock. On a skewed device that
// comparison is off by the skew, so the client treats valid sessions as expired
// and gets stuck refusing/looping on refresh — logging the user out and (because
// every from() awaits getSession) hanging unrelated reads.
//
// This storage wrapper re-expresses the stored expiry in the device's clock
// frame on read: device_expiry = server_exp + skew. With that, auth-js's check
// reduces to the token's true remaining lifetime regardless of how wrong the
// clock is. We derive it from the access token's own `exp` so it's correct no
// matter which auth-js code path last wrote the session. Writes pass through
// untouched; the next read re-derives from the freshest token. When skew is 0
// (clock correct, or not yet measured) this is a transparent no-op.
function compensatingStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return undefined
  const base = window.localStorage
  return {
    getItem(key) {
      const raw = base.getItem(key)
      const skewMs = getSkewMs()
      if (!raw || !skewMs) return raw
      try {
        const session = JSON.parse(raw)
        const exp = session?.access_token ? jwtExp(session.access_token) : null
        if (exp == null) return raw
        const deviceExp = exp + Math.round(skewMs / 1000)
        session.expires_at = deviceExp
        session.expires_in = deviceExp - Math.round(Date.now() / 1000)
        return JSON.stringify(session)
      } catch {
        return raw
      }
    },
    setItem(key, value) {
      base.setItem(key, value)
    },
    removeItem(key) {
      base.removeItem(key)
    },
  }
}

// Primary client: persists the session and auto-refreshes. The storage wrapper
// keeps it working on devices with a wrong clock.
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: compensatingStorage() },
})

// Session-less client for public, anonymous reads (homepage, about, public
// elections, site settings/branding). It never holds a user session, so it
// never waits on the auth refresh lock — public content keeps loading even if a
// logged-in user's session is wedged (e.g. by clock skew before compensation
// kicks in). Also used to measure clock skew before auth touches the session.
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // Distinct storage key so this instance never shares the auth lock with the
    // primary client (sharing it would reintroduce the very hang we're avoiding
    // and trip the "Multiple GoTrueClient instances" warning).
    storageKey: 'sb-public-noauth',
  },
})

export default supabase
