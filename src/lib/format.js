// Parse a YYYY-MM-DD date string as local (avoids the UTC off-by-one that
// `new Date('2026-05-20')` would cause) and format it.
export function formatDate(d, opts) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(
    undefined,
    opts ?? { year: 'numeric', month: 'long', day: 'numeric' },
  )
}

export function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Human-readable date + time for a timestamptz (used for scheduled sessions).
export function formatDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Convert a timestamptz/ISO string into the local "YYYY-MM-DDTHH:mm" value an
// <input type="datetime-local"> expects.
export function toDatetimeLocal(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

// A meeting's QR check-in is open when an officer flipped it on manually, or
// when "now" falls inside its optional scheduled window. Kept in sync with the
// attendance-insert RLS policy in 20260616080000_meeting_session_schedule.sql.
export function isSessionOpen(meeting, now = Date.now()) {
  if (!meeting) return false
  if (meeting.is_active) return true
  const start = meeting.session_start ? new Date(meeting.session_start).getTime() : null
  const end = meeting.session_end ? new Date(meeting.session_end).getTime() : null
  if (!start && !end) return false
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

// Today as a YYYY-MM-DD string in local time.
export function todayISO() {
  const now = new Date()
  const off = now.getTimezoneOffset()
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10)
}

// Turn a grade number into an ordinal label, e.g. 10 -> "10th Grade".
export function gradeLabel(n) {
  if (n == null) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]} Grade`
}

// Build a meeting title from the admin-configured format string, substituting
// the {date} token with a human-readable date. Falls back to a sensible default
// when no format is set.
export function meetingTitleFromFormat(format, dateISO) {
  let tpl = format?.trim() || 'SGA Meeting – {date}'
  const dateLabel = dateISO ? formatDate(dateISO) : ''

  // If the format has no {date} token, append the date so it always combines.
  if (!/\{date\}/.test(tpl)) tpl = `${tpl} – {date}`

  let out = tpl.replace(/\{date\}/g, dateLabel)

  // Collapse any run of adjacent dash separators (e.g. a stray "– —") into one.
  out = out.replace(/[–—-](?:\s*[–—-])+/g, '–')

  // When no date is chosen yet, drop the dangling trailing separator.
  if (!dateLabel) out = out.replace(/\s*[–—-]\s*$/, '')

  return out.trim()
}

export function checkinUrl(meetingId) {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/checkin/${meetingId}`
}
