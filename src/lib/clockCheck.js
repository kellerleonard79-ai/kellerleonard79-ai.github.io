import { supabasePublic } from './supabaseClient.js'

// A wrong device clock (or an auto-time-off time-zone change that shifts the
// actual UTC time) silently breaks Supabase auth, because auth-js compares the
// JWT's server-set expiry against the device's Date.now(). We measure the skew
// against the database server's own clock so we can (a) compensate token expiry
// in supabaseClient's storage wrapper and (b) warn the user. See the
// server_now() migration for why we read server time from a body, not a header.

// Whole-hour / whole-day clock or time-zone mistakes are the failure mode; this
// threshold sits well above network latency so a correctly-set clock never warns.
export const CLOCK_SKEW_THRESHOLD_MS = 5 * 60 * 1000

// How far ahead the device clock is vs. the server, in ms (positive = device is
// in the future). Read synchronously by the storage wrapper on every session
// read; stays 0 until measured, so compensation is a no-op until we know better.
let skewMs = 0
export function getSkewMs() {
  return skewMs
}

// Memoized so AuthContext (which awaits this before reading the session) and the
// ClockWarning banner share a single round-trip rather than measuring twice.
let inflight = null
export function measureClockSkew() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const t0 = Date.now()
      const { data, error } = await supabasePublic.rpc('server_now')
      const t1 = Date.now()
      if (error || !data) return null
      const serverMs = new Date(data).getTime()
      if (Number.isNaN(serverMs)) return null
      // Compare server time to the midpoint of our request window so round-trip
      // latency isn't mistaken for skew.
      skewMs = (t0 + t1) / 2 - serverMs
      return skewMs
    } catch {
      return null
    }
  })()
  return inflight
}
