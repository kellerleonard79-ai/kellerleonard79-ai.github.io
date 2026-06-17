import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import supabase from '../lib/supabaseClient.js'
import { PERMISSION_KEYS, overrideState } from '../lib/permissions.js'

// Per-member custom permission editor. Edits profiles.permission_overrides: a
// map of permission key -> boolean that wins over the member's role default
// (see src/lib/permissions.js). A key set back to "Default" is removed from the
// map so the row only stores genuine overrides. Used both by the Admin panel
// (Members & Roles) and the Member Directory dropdown — the write is gated by
// the manage_roles RLS policy + prevent_role_change guard, so callers must
// already hold manage_roles to reach it.
//
// Props:
//   member  — profile row incl. `role` (with permissions + is_admin) and
//             `permission_overrides`.
//   onSaved — called with the saved overrides map after a successful write, so
//             the parent can update its local copy.
export default function MemberPermissions({ member, onSaved }) {
  const role = member.role ?? null
  const saved = useMemo(() => member.permission_overrides ?? {}, [member])
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(saved)
    setError('')
  }, [saved])

  // Admin-tier members already pass every check, and overrides can't lock them
  // out — so editing here would be meaningless and misleading.
  if (role?.is_admin) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <ShieldCheck className="h-4 w-4 shrink-0 text-maroon" />
        Admin-tier members have every permission; overrides don't apply.
      </p>
    )
  }

  function setKey(key, value) {
    setDraft((prev) => {
      const next = { ...prev }
      if (value === 'default') delete next[key]
      else next[key] = value === 'grant'
      return next
    })
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  async function save() {
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ permission_overrides: draft })
      .eq('id', member.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved?.(draft)
  }

  return (
    <div>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {PERMISSION_KEYS.map(([key, label]) => {
          const roleAllows = role?.permissions?.[key] === true
          const state = overrideState(draft, key)
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span
                className={`text-sm ${
                  state === 'default' ? 'text-gray-600' : 'font-semibold text-maroon'
                }`}
              >
                {label}
              </span>
              <select
                value={state}
                onChange={(e) => setKey(key, e.target.value)}
                className={`shrink-0 rounded-lg border bg-white px-2.5 py-1.5 text-xs shadow-sm outline-none transition focus:ring-2 focus:ring-maroon/20 ${
                  state === 'grant'
                    ? 'border-green-300 text-green-700'
                    : state === 'revoke'
                      ? 'border-red-300 text-red-700'
                      : 'border-gray-300 text-gray-600'
                }`}
              >
                <option value="default">
                  Default ({roleAllows ? 'Allowed' : 'Denied'})
                </option>
                <option value="grant">Granted</option>
                <option value="revoke">Revoked</option>
              </select>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save overrides
        </button>
        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setDraft(saved)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  )
}
