import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import supabase from '../../lib/supabaseClient.js'
import { PERMISSION_KEYS } from '../../lib/permissions.js'
import { Card, Labeled, Loading, inputClass } from '../ui.jsx'

// Permission tiers (the `roles` table), formerly Admin Panel → "Permission
// Tiers". Now the Member Directory's Settings tab, next to the members whose
// tiers it governs.

export default function TiersTab() {
  const [roles, setRoles] = useState([])
  const [counts, setCounts] = useState({}) // role_id -> member count
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const [{ data: roleRows }, { data: profiles }] = await Promise.all([
      supabase.from('roles').select('*').order('order', { ascending: true }),
      supabase.from('profiles').select('role_id'),
    ])
    const c = {}
    for (const p of profiles ?? []) {
      if (p.role_id) c[p.role_id] = (c[p.role_id] ?? 0) + 1
    }
    setCounts(c)
    setRoles(roleRows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addTier() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const maxOrder = roles.reduce((m, r) => Math.max(m, r.order), 0)
    const permissions = Object.fromEntries(PERMISSION_KEYS.map(([k]) => [k, false]))
    const { error } = await supabase
      .from('roles')
      .insert({ name, order: maxOrder + 1, permissions, is_admin: false })
    setAdding(false)
    if (!error) {
      setNewName('')
      load()
    } else {
      window.alert(error.message)
    }
  }

  if (loading) return <Loading />

  const orders = roles.map((r) => r.order)

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <TierRow
          key={role.id}
          role={role}
          memberCount={counts[role.id] ?? 0}
          allOrders={orders}
          onChanged={load}
        />
      ))}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Labeled label="New tier name">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Committee Lead"
              className={inputClass}
            />
          </Labeled>
          <button
            onClick={addTier}
            disabled={adding || !newName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add tier
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          New tiers start with all permissions off.
        </p>
      </Card>
    </div>
  )
}

function TierRow({ role, memberCount, allOrders, onChanged }) {
  const [name, setName] = useState(role.name)
  const [order, setOrder] = useState(role.order)
  const [perms, setPerms] = useState(role.permissions ?? {})
  const [savingMeta, setSavingMeta] = useState(false)
  const locked = role.is_admin

  // Permission toggles each persist the *whole* permissions object. Without
  // care, rapid clicks (before React re-renders) all read the same stale
  // `perms` and clobber each other — last write wins, silently dropping a
  // toggle you turned on or re-adding one you turned off. `permsRef` is updated
  // synchronously so each toggle builds on the latest intent; savingRef/
  // pendingRef serialize the writes so only one is in flight and the final
  // state is what gets persisted.
  const permsRef = useRef(role.permissions ?? {})
  const savingRef = useRef(false)
  const pendingRef = useRef(null)

  useEffect(() => {
    setName(role.name)
    setOrder(role.order)
    setPerms(role.permissions ?? {})
    permsRef.current = role.permissions ?? {}
  }, [role])

  const orderCollision =
    !locked &&
    order !== role.order &&
    allOrders.includes(Number(order))

  const metaDirty = !locked && (name.trim() !== role.name || Number(order) !== role.order)

  async function saveMeta() {
    if (orderCollision || !name.trim()) return
    setSavingMeta(true)
    const { error } = await supabase
      .from('roles')
      .update({ name: name.trim(), order: Number(order) })
      .eq('id', role.id)
    setSavingMeta(false)
    if (error) window.alert(error.message)
    else onChanged()
  }

  // Serialize writes: persist the latest snapshot; if one is already in flight,
  // stash the newest and run it once the current one resolves. This guarantees
  // the value the DB ends up with is the last toggle the user made, regardless
  // of network ordering.
  async function persistPerms(next) {
    if (savingRef.current) {
      pendingRef.current = next
      return
    }
    savingRef.current = true
    const { error } = await supabase
      .from('roles')
      .update({ permissions: next })
      .eq('id', role.id)
    savingRef.current = false
    if (error) {
      pendingRef.current = null
      window.alert(error.message)
      onChanged() // reload from server so the UI reflects what actually saved
      return
    }
    if (pendingRef.current) {
      const queued = pendingRef.current
      pendingRef.current = null
      persistPerms(queued)
    }
  }

  function togglePerm(key) {
    if (locked) return
    // Build on the synchronously-tracked latest intent, not the (possibly
    // stale) render-time `perms`, so back-to-back clicks don't clobber.
    const next = { ...permsRef.current, [key]: !permsRef.current[key] }
    permsRef.current = next
    setPerms(next) // optimistic
    persistPerms(next)
  }

  async function remove() {
    if (memberCount > 0) return
    if (!window.confirm(`Delete the "${role.name}" tier? This cannot be undone.`))
      return
    const { error } = await supabase.from('roles').delete().eq('id', role.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500">
              Tier name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={locked}
              className={`${inputClass} ${locked ? 'bg-gray-50 text-gray-500' : ''}`}
            />
          </label>
          <label className="block w-24">
            <span className="mb-1 block text-xs font-semibold text-gray-500">
              Order
            </span>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              disabled={locked}
              className={`${inputClass} ${
                orderCollision ? 'border-red-300 focus:ring-red-200' : ''
              } ${locked ? 'bg-gray-50 text-gray-500' : ''}`}
            />
          </label>
          {locked && (
            <span className="mb-2.5 inline-flex items-center gap-1 rounded-full bg-maroon/10 px-2.5 py-1 text-xs font-semibold text-maroon">
              <Lock className="h-3 w-3" /> Admin
            </span>
          )}
          {metaDirty && (
            <button
              onClick={saveMeta}
              disabled={savingMeta || orderCollision || !name.trim()}
              className="mb-1 inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
            >
              {savingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
          )}
        </div>
        <button
          onClick={remove}
          disabled={locked || memberCount > 0}
          title={
            locked
              ? 'The admin tier cannot be deleted'
              : memberCount > 0
                ? `${memberCount} member(s) hold this tier`
                : 'Delete tier'
          }
          className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {orderCollision && (
        <p className="mt-2 text-xs text-red-600">
          Another tier already uses order {order}. Pick a unique number.
        </p>
      )}

      <div className="mt-4 grid gap-x-6 gap-y-2 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_KEYS.map(([key, label]) => {
          const checked = locked || perms[key] === true
          return (
            <label
              key={key}
              className={`flex items-center gap-2 text-sm ${
                locked ? 'text-gray-400' : 'cursor-pointer text-maroon'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={() => togglePerm(key)}
                className="h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30 disabled:opacity-60"
              />
              {label}
            </label>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {memberCount} member{memberCount === 1 ? '' : 's'} in this tier
      </p>
    </Card>
  )
}
