import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Wallet,
  Plus,
  Loader2,
  Trash2,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Pencil,
  Save,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate, todayISO } from '../lib/format.js'

export default function Bookkeeping() {
  return (
    <RequirePermission permission="view_bookkeeping">
      <BookkeepingContent />
    </RequirePermission>
  )
}

// Default `order` of the Executive Officer tier. Deleting an account is gated on
// the role hierarchy (Executive Officer and above) rather than a permission key,
// mirroring the RLS delete policy. Used as a fallback if the role was renamed.
const EXEC_OFFICER_ORDER = 4

// Format a numeric amount as USD currency.
function money(n) {
  return Number(n ?? 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  })
}

// Order transactions oldest-first and attach a cumulative running balance,
// starting from the account's starting_balance. Credits add, debits subtract.
// Running balance is derived here — never read from or written to the DB.
function withRunningBalance(transactions, startingBalance) {
  const ordered = [...transactions].sort((a, b) => {
    if (a.transaction_date !== b.transaction_date)
      return a.transaction_date < b.transaction_date ? -1 : 1
    // Tie-break on insertion time so same-day rows accumulate deterministically.
    return a.created_at < b.created_at ? -1 : 1
  })
  let balance = Number(startingBalance ?? 0)
  return ordered.map((t) => {
    balance += t.type === 'credit' ? Number(t.amount) : -Number(t.amount)
    return { ...t, runningBalance: balance }
  })
}

function BookkeepingContent() {
  const { hasPermission, profile } = useAuth()
  const canManage = hasPermission('manage_bookkeeping')
  // Executive Officers (and any tier above them) may delete accounts.
  const canDelete =
    profile?.role?.is_admin || (profile?.role?.order ?? 0) >= EXEC_OFFICER_ORDER

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  async function loadAccounts() {
    // RLS scopes accounts to the viewer's tier, so no client-side filtering.
    const { data } = await supabase
      .from('accounts')
      .select(
        'id, name, description, starting_balance, visibility_min_role_order, created_at',
      )
      .order('created_at', { ascending: false })
    setAccounts(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  if (selectedId) {
    const account = accounts.find((a) => a.id === selectedId)
    if (account) {
      return (
        <AccountLedger
          account={account}
          canManage={canManage}
          canDelete={canDelete}
          onBack={() => setSelectedId(null)}
          onChanged={loadAccounts}
        />
      )
    }
    // Account vanished (e.g. deleted) — fall back to the overview.
    setSelectedId(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Bookkeeping
            </h1>
            <p className="mt-1 text-gray-500">
              Account balances and ledgers.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {canManage && <NewAccountPanel onCreated={loadAccounts} />}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-maroon" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <Wallet className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-400">
                No accounts yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onOpen={() => setSelectedId(account.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

// ─────────────────────────── Account row ───────────────────────────
function AccountRow({ account, onOpen }) {
  const [balance, setBalance] = useState(null)

  // Balance = starting_balance + Σ credits − Σ debits. Fetched per row so the
  // overview reflects the latest ledger without loading every transaction up front.
  useEffect(() => {
    let active = true
    supabase
      .from('transactions')
      .select('type, amount')
      .eq('account_id', account.id)
      .then(({ data }) => {
        if (!active) return
        const sum = (data ?? []).reduce(
          (acc, t) =>
            acc + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount)),
          Number(account.starting_balance ?? 0),
        )
        setBalance(sum)
      })
    return () => {
      active = false
    }
  }, [account.id, account.starting_balance])

  return (
    <li>
      <button
        onClick={onOpen}
        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-bold text-maroon">
            {account.name}
          </h3>
          {account.description && (
            <p className="truncate text-sm text-gray-500">
              {account.description}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold text-maroon">
            {balance == null ? (
              <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-300" />
            ) : (
              money(balance)
            )}
          </p>
          <p className="text-xs text-gray-400">Current balance</p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-maroon" />
      </button>
    </li>
  )
}

// ─────────────────────────── New account panel ───────────────────────────
function NewAccountPanel({ onCreated }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [visibility, setVisibility] = useState(null)
  const [roleOptions, setRoleOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const myOrder = profile?.role?.order ?? 0

  // Visibility options: roles at or below the creator's tier — they can only
  // restrict down to their level, never hide from tiers above them.
  useEffect(() => {
    supabase
      .from('roles')
      .select('name, order')
      .lte('order', myOrder)
      .order('order', { ascending: true })
      .then(({ data }) => {
        const opts = data ?? []
        setRoleOptions(opts)
        setVisibility(opts.length ? opts[0].order : 0)
      })
  }, [myOrder])

  function reset() {
    setName('')
    setDescription('')
    setStartingBalance('')
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const n = name.trim()
    if (!n) return
    setSaving(true)
    const { error: insertError } = await supabase.from('accounts').insert({
      name: n,
      description: description.trim(),
      starting_balance: Number(startingBalance) || 0,
      visibility_min_role_order: visibility ?? 0,
      created_by: profile.id,
    })
    setSaving(false)
    if (insertError) {
      setError('Could not create the account. Please try again.')
      return
    }
    reset()
    setOpen(false)
    onCreated()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
      >
        <Plus className="h-4 w-4" /> New Account
      </button>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-maroon/10 text-maroon">
            <Wallet className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-bold text-maroon">
            New Account
          </h2>
        </div>
        <button
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={`${inputClass} resize-y`}
        />
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Starting balance
          </label>
          <input
            type="number"
            step="0.01"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Minimum tier to view
          </label>
          <select
            value={visibility ?? ''}
            onChange={(e) => setVisibility(Number(e.target.value))}
            className={inputClass}
          >
            {roleOptions.map((r) => (
              <option key={r.order} value={r.order}>
                {r.name} and above
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            You can only restrict down to your own tier — higher tiers can always
            see it.
          </p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Account
        </button>
      </form>
    </section>
  )
}

// ─────────────────────────── Edit account panel ───────────────────────────
function EditAccountPanel({ account, onSaved, onCancel }) {
  const { profile } = useAuth()
  const [name, setName] = useState(account.name)
  const [description, setDescription] = useState(account.description ?? '')
  const [startingBalance, setStartingBalance] = useState(
    String(account.starting_balance ?? ''),
  )
  const [visibility, setVisibility] = useState(
    account.visibility_min_role_order ?? 0,
  )
  const [roleOptions, setRoleOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const myOrder = profile?.role?.order ?? 0

  // Same rule as account creation: a manager can only restrict visibility down
  // to their own tier, never hide it from tiers above them.
  useEffect(() => {
    supabase
      .from('roles')
      .select('name, order')
      .lte('order', myOrder)
      .order('order', { ascending: true })
      .then(({ data }) => setRoleOptions(data ?? []))
  }, [myOrder])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const n = name.trim()
    if (!n) return
    setSaving(true)
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        name: n,
        description: description.trim(),
        starting_balance: Number(startingBalance) || 0,
        visibility_min_role_order: visibility ?? 0,
      })
      .eq('id', account.id)
    setSaving(false)
    if (updateError) {
      setError('Could not save changes. Please try again.')
      return
    }
    onSaved()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-maroon/10 text-maroon">
            <Pencil className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-bold text-maroon">
            Edit Account
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={`${inputClass} resize-y`}
        />

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Starting balance
          </label>
          <input
            type="number"
            step="0.01"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Minimum tier to view
          </label>
          <select
            value={visibility ?? ''}
            onChange={(e) => setVisibility(Number(e.target.value))}
            className={inputClass}
          >
            {roleOptions.map((r) => (
              <option key={r.order} value={r.order}>
                {r.name} and above
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            You can only restrict down to your own tier — higher tiers can always
            see it.
          </p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}

// ─────────────────────────── Account ledger ───────────────────────────
function AccountLedger({ account, canManage, canDelete, onBack, onChanged }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('transactions')
      .select('id, type, amount, notes, transaction_date, created_at')
      .eq('account_id', account.id)
    setTransactions(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id])

  // Chronological (oldest-first) rows with running balance, then reverse for
  // display so the newest transaction sits at the top of the table.
  const chronological = useMemo(
    () => withRunningBalance(transactions, account.starting_balance),
    [transactions, account.starting_balance],
  )
  const display = useMemo(
    () => [...chronological].reverse(),
    [chronological],
  )
  const currentBalance = chronological.length
    ? chronological[chronological.length - 1].runningBalance
    : Number(account.starting_balance ?? 0)

  function exportCsv() {
    const header = 'date,type,amount,notes,running_balance\n'
    // Export oldest-first so the running balance column reads naturally.
    const rows = chronological
      .map((t) =>
        [
          csvCell(t.transaction_date),
          csvCell(t.type),
          csvCell(Number(t.amount).toFixed(2)),
          csvCell(t.notes),
          csvCell(t.runningBalance.toFixed(2)),
        ].join(','),
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName = account.name.replace(/[^\w.\-]+/g, '_')
    link.download = `${safeName}-ledger-${todayISO()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        `Delete the "${account.name}" account and all of its transactions? This cannot be undone.`,
      )
    )
      return
    setDeleting(true)
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', account.id)
    setDeleting(false)
    if (error) {
      window.alert('Could not delete the account.')
      return
    }
    onChanged?.()
    onBack()
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction? This cannot be undone.'))
      return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      window.alert('Could not delete the transaction.')
      return
    }
    load()
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" /> All accounts
        </button>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              {account.name}
            </h1>
            {account.description && (
              <p className="mt-1 text-gray-500">{account.description}</p>
            )}
            {(canManage || canDelete) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {canManage && (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-maroon hover:text-maroon"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={deleteAccount}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete Account
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold text-maroon">
              {money(currentBalance)}
            </p>
            <p className="text-xs text-gray-400">Current balance</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {editing && (
            <EditAccountPanel
              account={account}
              onSaved={() => {
                setEditing(false)
                onChanged?.()
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          {canManage && (
            <AddTransactionPanel account={account} onAdded={load} />
          )}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-maroon">
                Ledger
              </h2>
              <button
                onClick={exportCsv}
                disabled={transactions.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-maroon px-3.5 py-1.5 text-sm font-semibold text-maroon transition hover:bg-maroon/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-maroon" />
              </div>
            ) : display.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">
                No transactions yet. Starting balance:{' '}
                {money(account.starting_balance)}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Amount
                      </th>
                      <th className="px-5 py-3 font-semibold">Notes</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Balance
                      </th>
                      {canManage && <th className="px-5 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {display.map((t) => {
                      const credit = t.type === 'credit'
                      return (
                        <tr key={t.id} className="hover:bg-gray-50/60">
                          <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                            {formatDate(t.transaction_date, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                credit
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {credit ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {credit ? 'Credit' : 'Debit'}
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-3 text-right font-medium ${
                              credit ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {credit ? '+' : '−'}
                            {money(t.amount)}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {t.notes}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-maroon">
                            {money(t.runningBalance)}
                          </td>
                          {canManage && (
                            <td className="px-5 py-3 text-right">
                              <button
                                onClick={() => deleteTransaction(t.id)}
                                title="Delete"
                                className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// ─────────────────────────── Add transaction panel ───────────────────────────
function AddTransactionPanel({ account, onAdded }) {
  const { profile } = useAuth()
  const [type, setType] = useState('credit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amt = Number(amount)
    if (!(amt > 0)) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('transactions').insert({
      account_id: account.id,
      type,
      amount: amt,
      notes: notes.trim(),
      transaction_date: date,
      created_by: profile.id,
    })
    setSaving(false)
    if (insertError) {
      setError('Could not add the transaction. Please try again.')
      return
    }
    setAmount('')
    setNotes('')
    setType('credit')
    setDate(todayISO())
    onAdded()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-maroon">
          Add Transaction
        </h2>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="credit">Credit (+)</option>
            <option value="debit">Debit (−)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Notes
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 sm:col-span-2 lg:col-span-4">
            {error}
          </p>
        )}
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Transaction
          </button>
        </div>
      </form>
    </section>
  )
}

// Escape a value for CSV: wrap in quotes and double internal quotes when it
// contains a comma, quote, or newline.
function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
