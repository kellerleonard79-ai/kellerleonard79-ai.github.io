import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Loader2,
  Check,
  X,
  CheckCircle2,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import supabase from '../lib/supabaseClient.js'

export default function SecurityClearance() {
  return (
    <RequirePermission permission="manage_roles">
      <SecurityContent />
    </RequirePermission>
  )
}

// Mirrors clearanceForRole in Profile.jsx so the legacy clearance_level stays in
// sync with role_id while the app still reads clearance_level in places.
function clearanceForRole(role) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

function SecurityContent() {
  const [members, setMembers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, student_id, status, role_id, role:roles(name, is_admin)',
        )
        .order('full_name', { ascending: true }),
      supabase
        .from('roles')
        .select('id, name, permissions, is_admin')
        .order('order', { ascending: true }),
    ])
    setMembers(m ?? [])
    setRoles(r ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pending = useMemo(
    () => members.filter((m) => (m.status ?? 'active') === 'pending'),
    [members],
  )
  const active = useMemo(
    () => members.filter((m) => (m.status ?? 'active') !== 'pending'),
    [members],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Security Clearance
            </h1>
            <p className="mt-1 text-gray-500">
              Approve new members and set each member's role.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <CreateAccountSection roles={roles} onChanged={load} />
            <PendingSection
              pending={pending}
              roles={roles}
              onChanged={load}
            />
            <RolesSection
              members={active}
              roles={roles}
              onChanged={load}
            />
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

// Shared card chrome, matching EditSite's Section.
function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-maroon">{title}</h2>
          {desc && <p className="text-sm text-gray-500">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ───────────────────────── Create account ─────────────────────────
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

const EMPTY_ACCOUNT = {
  full_name: '',
  student_id: '',
  email: '',
  password: '',
  grade_level: '',
  shirt_size: '',
  role_id: '',
}

// Lets an SCI create an already-approved account for someone (no self-signup
// needed). Runs through the privileged create-user Edge Function, which gates on
// is_admin(), creates the auth user with a confirmed email, and activates the
// profile with the chosen role.
function CreateAccountSection({ roles, onChanged }) {
  const [form, setForm] = useState(EMPTY_ACCOUNT)
  const [status, setStatus] = useState('idle') // idle | submitting | success
  const [error, setError] = useState('')

  // Default the role select to the configurable General Member tier.
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

    // invoke() surfaces non-2xx as fnError; the function also returns { error }.
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
    <Section
      icon={UserPlus}
      title="Create Member Account"
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
        <AccountField label="Full Name">
          <input
            type="text"
            required
            value={form.full_name}
            onChange={update('full_name')}
            className={inputClass}
            placeholder="Jordan Tiger"
          />
        </AccountField>

        <AccountField label="Student ID">
          <input
            type="text"
            value={form.student_id}
            onChange={update('student_id')}
            className={inputClass}
            placeholder="1234567"
          />
        </AccountField>

        <AccountField label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={update('email')}
            className={inputClass}
            placeholder="member@example.com"
          />
        </AccountField>

        <AccountField label="Temporary Password">
          <input
            type="text"
            required
            minLength={6}
            value={form.password}
            onChange={update('password')}
            className={inputClass}
            placeholder="At least 6 characters"
          />
        </AccountField>

        <AccountField label="Grade">
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
        </AccountField>

        <AccountField label="Shirt Size">
          <input
            type="text"
            value={form.shirt_size}
            onChange={update('shirt_size')}
            className={inputClass}
            placeholder="Optional"
          />
        </AccountField>

        <AccountField label="Role">
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
        </AccountField>

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
    </Section>
  )
}

function AccountField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-maroon">
        {label}
      </span>
      {children}
    </label>
  )
}

// ───────────────────────── Pending approvals ─────────────────────────
function PendingSection({ pending, roles, onChanged }) {
  const [busyId, setBusyId] = useState(null)

  // The role new members are approved into — the configurable "General Member"
  // tier, falling back to the lowest-order non-admin role.
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
    // Remove the auth.users record via the privileged Edge Function (cascades
    // the profile), then delete the profile row explicitly as a fallback.
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
    <Section
      icon={UserCheck}
      title="Pending Approvals"
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
                  <button
                    onClick={() => reject(m)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

// ───────────────────────── Role management ─────────────────────────
function RolesSection({ members, roles, onChanged }) {
  const [busyId, setBusyId] = useState(null)

  async function changeRole(member, roleId) {
    const role = roles.find((r) => r.id === roleId)
    setBusyId(member.id)
    await supabase
      .from('profiles')
      .update({ role_id: roleId, clearance_level: clearanceForRole(role) })
      .eq('id', member.id)
    setBusyId(null)
    onChanged()
  }

  return (
    <Section
      icon={ShieldCheck}
      title="Member Roles"
      desc="The only place a member's role is changed. Admin-tier members are locked."
    >
      {members.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No members yet.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            // Admin-tier members can't be demoted from here.
            const locked = Boolean(m.role?.is_admin)
            const busy = busyId === m.id
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-maroon">
                      {m.full_name ?? 'Member'}
                    </p>
                    {(m.status ?? 'active') !== 'active' && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {m.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {m.student_id ? `ID ${m.student_id}` : 'No student ID'}
                  </p>
                </div>
                {locked ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-maroon/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-maroon">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {m.role?.name ?? 'Admin'}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {busy && (
                      <Loader2 className="h-4 w-4 animate-spin text-maroon" />
                    )}
                    <select
                      value={m.role_id ?? ''}
                      onChange={(e) => changeRole(m, e.target.value)}
                      disabled={busy}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20 disabled:opacity-60"
                    >
                      {!m.role_id && <option value="">— None —</option>}
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
