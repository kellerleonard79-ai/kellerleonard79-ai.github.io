import { useMemo, useState } from 'react'
import { Check, CheckCircle2, Loader2, UserPlus, X } from 'lucide-react'
import supabase from '../../lib/supabaseClient.js'
import { Card, Labeled, inputClass } from '../ui.jsx'

// Member administration, formerly Admin Panel → "Members & Roles". The pending
// queue now sits at the top of the Member Directory and the create-account form
// lives in that page's Settings tab; role changes happen inline on directory
// rows via setMemberRole below.

// Mirrors clearanceForRole in Profile.jsx so the legacy clearance_level stays in
// sync with role_id while the app still reads clearance_level in places.
export function clearanceForRole(role) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

// The one place a member's role is written. Kept here (rather than inline in the
// directory) so the legacy clearance_level mirror can never drift from role_id.
export async function setMemberRole(member, roleId, roles) {
  const role = roles.find((r) => r.id === roleId)
  return supabase
    .from('profiles')
    .update({ role_id: roleId, clearance_level: clearanceForRole(role) })
    .eq('id', member.id)
}

const EMPTY_ACCOUNT = {
  full_name: '',
  student_id: '',
  email: '',
  password: '',
  grade_level: '',
  shirt_size: '',
  role_id: '',
}

export function CreateAccountCard({ roles, onChanged }) {
  const [form, setForm] = useState(EMPTY_ACCOUNT)
  const [status, setStatus] = useState('idle') // idle | submitting | success
  const [error, setError] = useState('')

  const defaultRoleId = useMemo(() => {
    const named = roles.find((r) => r.name === 'General Member')
    if (named) return named.id
    return roles.find((r) => !r.is_admin)?.id ?? ''
  }, [roles])

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('submitting')

    const { data, error: fnError } = await supabase.functions.invoke(
      'create-user',
      {
        body: {
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim(),
          email: form.email.trim(),
          password: form.password,
          grade_level: form.grade_level,
          shirt_size: form.shirt_size.trim(),
          role_id: form.role_id || defaultRoleId || null,
        },
      },
    )

    const message = fnError?.message || data?.error
    if (message) {
      setError(message)
      setStatus('idle')
      return
    }

    setForm(EMPTY_ACCOUNT)
    setStatus('success')
    onChanged()
  }

  return (
    <Card
      title="Create member account"
      desc="Add an already-approved member directly — they can log in right away with the email and password you set."
    >
      {status === 'success' && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Account created. Share the login details with the new member.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Full Name">
          <input
            type="text"
            required
            value={form.full_name}
            onChange={update('full_name')}
            className={inputClass}
            placeholder="Jordan Tiger"
          />
        </Labeled>

        <Labeled label="Student ID">
          <input
            type="text"
            value={form.student_id}
            onChange={update('student_id')}
            className={inputClass}
            placeholder="1234567"
          />
        </Labeled>

        <Labeled label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={update('email')}
            className={inputClass}
            placeholder="member@example.com"
          />
        </Labeled>

        <Labeled label="Temporary Password">
          <input
            type="text"
            required
            minLength={6}
            value={form.password}
            onChange={update('password')}
            className={inputClass}
            placeholder="At least 6 characters"
          />
        </Labeled>

        <Labeled label="Grade">
          <select
            value={form.grade_level}
            onChange={update('grade_level')}
            className={inputClass}
          >
            <option value="">— Optional —</option>
            {['9', '10', '11', '12'].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Labeled>

        <Labeled label="Shirt Size">
          <input
            type="text"
            value={form.shirt_size}
            onChange={update('shirt_size')}
            className={inputClass}
            placeholder="Optional"
          />
        </Labeled>

        <Labeled label="Role">
          <select
            value={form.role_id || defaultRoleId}
            onChange={update('role_id')}
            className={inputClass}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Labeled>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Create Account
              </>
            )}
          </button>
        </div>
      </form>
    </Card>
  )
}

// canReject gates the Reject button: rejection deletes the auth user through an
// Edge Function that authorizes on is_admin(), so a manage_roles-only reviewer
// can approve but not delete.
export function PendingCard({ pending, roles, onChanged, canReject = true }) {
  const [busyId, setBusyId] = useState(null)

  const defaultRole = useMemo(() => {
    const named = roles.find((r) => r.name === 'General Member')
    if (named) return named
    return roles.find((r) => !r.is_admin) ?? null
  }, [roles])

  async function approve(member) {
    setBusyId(member.id)
    await supabase
      .from('profiles')
      .update({
        status: 'active',
        role_id: defaultRole?.id ?? member.role_id,
        clearance_level: clearanceForRole(defaultRole),
      })
      .eq('id', member.id)
    setBusyId(null)
    onChanged()
  }

  async function reject(member) {
    if (
      !window.confirm(
        `Reject and permanently delete ${
          member.full_name ?? 'this applicant'
        }'s account? This cannot be undone.`,
      )
    )
      return
    setBusyId(member.id)
    const { error: fnError } = await supabase.functions.invoke('delete-user', {
      body: { user_id: member.id },
    })
    if (fnError) {
      setBusyId(null)
      window.alert(`Reject failed: ${fnError.message}`)
      return
    }
    await supabase.from('profiles').delete().eq('id', member.id)
    setBusyId(null)
    onChanged()
  }

  return (
    <Card
      title="Pending approvals"
      desc="New signups awaiting review. They cannot log in until approved."
    >
      {pending.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">
          No pending applications.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((m) => {
            const busy = busyId === m.id
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-maroon">
                    {m.full_name ?? 'Applicant'}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {m.student_id ? `ID ${m.student_id}` : 'No student ID'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => approve(m)}
                    disabled={busy || !defaultRole}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  {canReject && (
                    <button
                      onClick={() => reject(m)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
