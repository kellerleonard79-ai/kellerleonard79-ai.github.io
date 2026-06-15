import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Palette,
  ShieldCheck,
  Award,
  ClipboardList,
  ListChecks,
  Settings2,
  Loader2,
  Check,
  Plus,
  Trash2,
  Upload,
  GripVertical,
  Lock,
  Download,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { meetingTitleFromFormat, todayISO } from '../lib/format.js'

// The fixed permission set, in the order the plan lists them. Used by the
// Permission Tiers tab.
const PERMISSION_KEYS = [
  ['view_directory', 'View directory'],
  ['edit_directory', 'Edit directory'],
  ['view_meetings', 'View meetings'],
  ['create_meetings', 'Create meetings'],
  ['edit_agendas', 'Edit agendas'],
  ['view_bookkeeping', 'View bookkeeping'],
  ['manage_bookkeeping', 'Manage bookkeeping'],
  ['view_archives', 'View archives'],
  ['upload_archives', 'Upload archives'],
  ['view_elections', 'View elections'],
  ['manage_elections', 'Manage elections'],
  ['edit_site', 'Edit site'],
  ['manage_roles', 'Manage roles'],
  ['manage_committees', 'Manage committees'],
]

const POSITION_GROUPS = [
  'exec',
  'senior',
  'junior',
  'sophomore',
  'freshman',
  'custom',
]

const TABS = [
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'tiers', label: 'Permission Tiers', icon: ShieldCheck },
  { key: 'positions', label: 'Elected Positions', icon: Award },
  { key: 'join', label: 'Join Form', icon: ClipboardList },
  { key: 'sections', label: 'Agenda Sections', icon: ListChecks },
  { key: 'general', label: 'General', icon: Settings2 },
]

export default function AdminSettings() {
  return (
    <RequirePermission permission="manage_roles">
      <AdminContent />
    </RequirePermission>
  )
}

function AdminContent() {
  const [tab, setTab] = useState('branding')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Admin Settings
            </h1>
            <p className="mt-1 text-gray-500">
              Branding, permission tiers, positions, forms, and site behavior.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        {/* Tab bar — scrolls horizontally on narrow screens instead of wrapping */}
        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'border-maroon text-maroon'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>

        <div className="mt-8">
          {tab === 'branding' && <BrandingTab />}
          {tab === 'tiers' && <TiersTab />}
          {tab === 'positions' && <PositionsTab />}
          {tab === 'join' && <JoinFormTab />}
          {tab === 'sections' && <SectionTypesTab />}
          {tab === 'general' && <GeneralTab />}
        </div>
      </div>
      <Footer />
    </div>
  )
}

/* ───────────────────────── shared bits ───────────────────────── */
function Card({ title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {(title || desc) && (
        <div className="border-b border-gray-100 p-5">
          {title && (
            <h2 className="font-display text-lg font-bold text-gray-900">
              {title}
            </h2>
          )}
          {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

function SaveButton({ onClick, saving, saved, disabled, label = 'Save changes' }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-sm text-green-600">
          <Check className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/* ═══════════════════════ Tab 1 — Branding ═══════════════════════ */
function BrandingTab() {
  const { settings, refresh } = useSiteSettings()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // Seed the editable copy once settings arrive.
  useEffect(() => {
    if (settings && !form) {
      setForm({
        school_name: settings.school_name ?? '',
        tagline: settings.tagline ?? '',
        logo_url: settings.logo_url ?? '',
        primary_color: settings.primary_color ?? '#8e231c',
        accent_color: settings.accent_color ?? '#c8a24a',
        bg_color: settings.bg_color ?? '#ffffff',
      })
    }
  }, [settings, form])

  // Restore the saved branding colors on unmount so an unsaved live preview
  // doesn't leak into the rest of the session.
  const savedRef = useRef(settings)
  savedRef.current = settings
  useEffect(() => {
    return () => {
      const s = savedRef.current
      if (!s) return
      const root = document.documentElement
      if (s.primary_color) {
        root.style.setProperty('--color-primary', s.primary_color)
        root.style.setProperty('--color-maroon', s.primary_color)
      }
      if (s.accent_color) {
        root.style.setProperty('--color-accent', s.accent_color)
      }
      if (s.bg_color) root.style.setProperty('--color-bg', s.bg_color)
    }
  }, [])

  // Live-apply a valid color to the CSS custom properties as the admin types,
  // mirroring SiteSettingsContext.applyBranding so the preview is the whole UI.
  function setColor(field, cssVars) {
    return (value) => {
      setForm((f) => ({ ...f, [field]: value }))
      setSaved(false)
      if (HEX_RE.test(value)) {
        const root = document.documentElement
        for (const v of cssVars) root.style.setProperty(v, value)
      }
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true })
    if (upErr) {
      setError('Logo upload failed. Please try again.')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    setForm((f) => ({ ...f, logo_url: data.publicUrl }))
    setSaved(false)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    const { error: upErr } = await supabase
      .from('site_settings')
      .update({
        school_name: form.school_name.trim(),
        tagline: form.tagline.trim(),
        logo_url: form.logo_url || null,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        bg_color: form.bg_color,
      })
      .eq('id', 1)
    if (upErr) {
      setError('Could not save branding. Please try again.')
    } else {
      await refresh() // applies branding site-wide immediately
      setSaved(true)
    }
    setSaving(false)
  }

  if (!form) {
    return <Loading />
  }

  return (
    <div className="space-y-6">
      <Card title="Identity" desc="Name and tagline shown across the site.">
        <div className="grid gap-5">
          <Labeled label="School name">
            <input
              value={form.school_name}
              onChange={(e) => {
                setForm((f) => ({ ...f, school_name: e.target.value }))
                setSaved(false)
              }}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Tagline">
            <input
              value={form.tagline}
              onChange={(e) => {
                setForm((f) => ({ ...f, tagline: e.target.value }))
                setSaved(false)
              }}
              className={inputClass}
            />
          </Labeled>
        </div>
      </Card>

      <Card title="Logo" desc="Replaces the PHS crest in the nav, hero, and footer.">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src="/crest.png"
                alt="Current crest"
                className="h-full w-full object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {form.logo_url ? 'Replace logo' : 'Upload logo'}
            </label>
            {form.logo_url && (
              <button
                onClick={() => {
                  setForm((f) => ({ ...f, logo_url: '' }))
                  setSaved(false)
                }}
                className="ml-2 text-sm font-medium text-gray-400 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Colors" desc="Changes preview live across the whole site as you type.">
        <div className="grid gap-5 sm:grid-cols-3">
          <ColorField
            label="Primary"
            value={form.primary_color}
            onChange={setColor('primary_color', ['--color-primary', '--color-maroon'])}
          />
          <ColorField
            label="Accent"
            value={form.accent_color}
            onChange={setColor('accent_color', ['--color-accent'])}
          />
          <ColorField
            label="Background"
            value={form.bg_color}
            onChange={setColor('bg_color', ['--color-bg'])}
          />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Tip: live preview reverts if you leave without saving.
        </p>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaveButton onClick={save} saving={saving} saved={saved} />
    </div>
  )
}

function ColorField({ label, value, onChange }) {
  const valid = HEX_RE.test(value)
  return (
    <Labeled label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? expandHex(value) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={`${inputClass} font-mono ${
            valid ? '' : 'border-red-300 focus:border-red-400 focus:ring-red-200'
          }`}
        />
      </div>
    </Labeled>
  )
}

// <input type=color> requires a 6-digit hex; expand a 3-digit shorthand.
function expandHex(hex) {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return '#' + hex.slice(1).split('').map((c) => c + c).join('')
  }
  return hex
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </span>
      {children}
    </label>
  )
}

/* ═══════════════════════ Tab 2 — Permission Tiers ═══════════════════════ */
function TiersTab() {
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

  useEffect(() => {
    setName(role.name)
    setOrder(role.order)
    setPerms(role.permissions ?? {})
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

  async function togglePerm(key) {
    if (locked) return
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next) // optimistic
    const { error } = await supabase
      .from('roles')
      .update({ permissions: next })
      .eq('id', role.id)
    if (error) {
      setPerms(perms) // revert
      window.alert(error.message)
    }
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
                locked ? 'text-gray-400' : 'cursor-pointer text-gray-700'
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

/* ═══════════════════════ Tab 3 — Elected Positions ═══════════════════════ */
function PositionsTab() {
  const [positions, setPositions] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', group: 'exec', order: 1 })

  const load = useCallback(async () => {
    const [{ data: pos }, { data: profiles }] = await Promise.all([
      supabase
        .from('elected_positions')
        .select('*')
        .order('group', { ascending: true })
        .order('order', { ascending: true }),
      supabase.from('profiles').select('elected_position_id'),
    ])
    const c = {}
    for (const p of profiles ?? []) {
      if (p.elected_position_id)
        c[p.elected_position_id] = (c[p.elected_position_id] ?? 0) + 1
    }
    setCounts(c)
    setPositions(pos ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addPosition() {
    const title = draft.title.trim()
    if (!title) return
    setAdding(true)
    const { error } = await supabase.from('elected_positions').insert({
      title,
      group: draft.group,
      order: Number(draft.order) || 0,
      show_in_elections: true,
    })
    setAdding(false)
    if (!error) {
      setDraft({ title: '', group: 'exec', order: 1 })
      load()
    } else {
      window.alert(error.message)
    }
  }

  if (loading) return <Loading />

  const grouped = POSITION_GROUPS.map((g) => ({
    group: g,
    items: positions.filter((p) => p.group === g),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      {grouped.map(({ group, items }) => (
        <Card key={group} title={groupLabel(group)}>
          <div className="space-y-3">
            {items.map((pos) => (
              <PositionRow
                key={pos.id}
                position={pos}
                memberCount={counts[pos.id] ?? 0}
                onChanged={load}
              />
            ))}
          </div>
        </Card>
      ))}

      <Card title="Add position">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <Labeled label="Title">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Historian"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Group">
            <select
              value={draft.group}
              onChange={(e) => setDraft((d) => ({ ...d, group: e.target.value }))}
              className={inputClass}
            >
              {POSITION_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {groupLabel(g)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Order">
            <input
              type="number"
              value={draft.order}
              onChange={(e) => setDraft((d) => ({ ...d, order: e.target.value }))}
              className={`${inputClass} w-24`}
            />
          </Labeled>
          <button
            onClick={addPosition}
            disabled={adding || !draft.title.trim()}
            className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-maroon px-4 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </Card>
    </div>
  )
}

function PositionRow({ position, memberCount, onChanged }) {
  const [title, setTitle] = useState(position.title)
  const [group, setGroup] = useState(position.group)
  const [order, setOrder] = useState(position.order)

  useEffect(() => {
    setTitle(position.title)
    setGroup(position.group)
    setOrder(position.order)
  }, [position])

  const dirty =
    title.trim() !== position.title ||
    group !== position.group ||
    Number(order) !== position.order

  async function save() {
    if (!title.trim()) return
    const { error } = await supabase
      .from('elected_positions')
      .update({ title: title.trim(), group, order: Number(order) })
      .eq('id', position.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  async function toggleElections(next) {
    const { error } = await supabase
      .from('elected_positions')
      .update({ show_in_elections: next })
      .eq('id', position.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  async function remove() {
    if (memberCount > 0) return
    if (!window.confirm(`Delete "${position.title}"?`)) return
    const { error } = await supabase
      .from('elected_positions')
      .delete()
      .eq('id', position.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${inputClass} flex-1 min-w-[12rem]`}
      />
      <select
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        className={`${inputClass} w-36`}
      >
        {POSITION_GROUPS.map((g) => (
          <option key={g} value={g}>
            {groupLabel(g)}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        className={`${inputClass} w-20`}
      />
      <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
        <Toggle checked={position.show_in_elections} onChange={toggleElections} />
        Elections
      </label>
      {dirty && (
        <button
          onClick={save}
          disabled={!title.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
        >
          Save
        </button>
      )}
      <button
        onClick={remove}
        disabled={memberCount > 0}
        title={memberCount > 0 ? `${memberCount} member(s) hold this` : 'Delete'}
        className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function groupLabel(g) {
  return (
    {
      exec: 'Executive Board',
      senior: 'Senior Class',
      junior: 'Junior Class',
      sophomore: 'Sophomore Class',
      freshman: 'Freshman Class',
      custom: 'Custom',
    }[g] ?? g
  )
}

/* ═══════════════════════ Tab 4 — Join Form Builder ═══════════════════════ */
// Core fields are always present and locked; they are not stored in the schema.
const CORE_FIELDS = [
  'Full Name',
  'Student ID',
  'Email',
  'Password',
  'Confirm Password',
  'Applying as candidate?',
]

function JoinFormTab() {
  const { settings, refresh } = useSiteSettings()
  const [schema, setSchema] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({
    label: '',
    type: 'text',
    required: false,
    options: '',
  })

  useEffect(() => {
    if (settings && schema === null) {
      setSchema(
        Array.isArray(settings.join_form_schema)
          ? settings.join_form_schema
          : [],
      )
    }
  }, [settings, schema])

  function markDirty(next) {
    setSchema(next)
    setSaved(false)
  }

  function setField(idx, patch) {
    markDirty(schema.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  function removeField(idx) {
    markDirty(schema.filter((_, i) => i !== idx))
  }

  function addField() {
    const label = draft.label.trim()
    if (!label) return
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now().toString(36)}`
    const field = {
      key,
      type: draft.type,
      label,
      required: draft.required,
      custom: true,
      enabled: true,
    }
    if (draft.type === 'select') {
      field.options = draft.options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    }
    markDirty([...schema, field])
    setDraft({ label: '', type: 'text', required: false, options: '' })
    setShowAdd(false)
  }

  function handleDrop(targetIdx) {
    const from = dragIdx
    setDragIdx(null)
    if (from === null || from === targetIdx) return
    const next = [...schema]
    const [moved] = next.splice(from, 1)
    next.splice(targetIdx, 0, moved)
    markDirty(next)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({ join_form_schema: schema })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    } else {
      window.alert(error.message)
    }
    setSaving(false)
  }

  if (schema === null) return <Loading />

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="space-y-4">
        <Card title="Core fields" desc="Always present and cannot be removed.">
          <div className="space-y-2">
            {CORE_FIELDS.map((label) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              >
                <span>{label}</span>
                <Lock className="h-3.5 w-3.5" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Configurable fields" desc="Toggle, reorder (drag), or remove.">
          {schema.length === 0 ? (
            <p className="py-2 text-sm text-gray-400">No extra fields yet.</p>
          ) : (
            <div className="space-y-2">
              {schema.map((field, idx) => (
                <div
                  key={field.key ?? idx}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(idx)
                  }}
                  className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 ${
                    dragIdx === idx ? 'opacity-50' : ''
                  }`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-800">
                        {field.label}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {field.type}
                      </span>
                      {field.custom && (
                        <span className="rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-maroon">
                          Custom
                        </span>
                      )}
                    </div>
                    {field.type === 'select' &&
                      Array.isArray(field.options) && (
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {field.options.join(', ')}
                        </p>
                      )}
                  </div>
                  {/* Default (non-custom) fields get an enable toggle; all fields
                      get a required toggle. */}
                  {!field.custom && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Toggle
                        checked={field.enabled !== false}
                        onChange={(v) => setField(idx, { enabled: v })}
                      />
                      On
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Toggle
                      checked={field.required === true}
                      onChange={(v) => setField(idx, { required: v })}
                    />
                    Req
                  </label>
                  {field.custom && (
                    <button
                      onClick={() => removeField(idx)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {showAdd ? (
            <div className="mt-4 space-y-3 rounded-xl border border-dashed border-gray-300 p-4">
              <Labeled label="Field label">
                <input
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Teacher recommendation"
                />
              </Labeled>
              <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Type">
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="text">Text input</option>
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </Labeled>
                <label className="flex items-end gap-2 pb-2.5 text-sm text-gray-600">
                  <Toggle
                    checked={draft.required}
                    onChange={(v) => setDraft((d) => ({ ...d, required: v }))}
                  />
                  Required
                </label>
              </div>
              {draft.type === 'select' && (
                <Labeled label="Options (comma-separated)">
                  <input
                    value={draft.options}
                    onChange={(e) => setDraft((d) => ({ ...d, options: e.target.value }))}
                    className={inputClass}
                    placeholder="Option A, Option B, Option C"
                  />
                </Labeled>
              )}
              <div className="flex gap-2">
                <button
                  onClick={addField}
                  disabled={!draft.label.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Add field
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 transition hover:border-maroon/40 hover:text-maroon"
            >
              <Plus className="h-4 w-4" /> Add custom field
            </button>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <SaveButton onClick={save} saving={saving} saved={saved} label="Save form" />
          </div>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card title="Live preview" desc="How the Join SGA form will render.">
          <JoinPreview schema={schema} />
        </Card>
      </div>
    </div>
  )
}

function JoinPreview({ schema }) {
  return (
    <div className="space-y-4">
      <PreviewField label="Full Name" />
      <PreviewField label="Student ID" />
      {schema
        .filter((f) => f.enabled !== false)
        .map((f) => (
          <PreviewDynamicField key={f.key} field={f} />
        ))}
      <hr className="border-gray-100" />
      <PreviewField label="Email" type="email" />
      <PreviewField label="Password" type="password" />
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
        <input type="checkbox" disabled className="mt-0.5" />
        I&apos;m running for a position
      </div>
    </div>
  )
}

function PreviewField({ label, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">
        {label}
      </span>
      <input type={type} disabled className={`${inputClass} bg-gray-50`} />
    </label>
  )
}

function PreviewDynamicField({ field }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" disabled />
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>
    )
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {field.type === 'select' ? (
        <select disabled className={`${inputClass} bg-gray-50`}>
          <option>Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input disabled className={`${inputClass} bg-gray-50`} />
      )}
    </label>
  )
}

/* ═══════════════════════ Tab 5 — Agenda Section Types ═══════════════════════ */
function SectionTypesTab() {
  const [types, setTypes] = useState([])
  const [usage, setUsage] = useState({}) // section_type_id -> item count
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', is_default: true })

  const load = useCallback(async () => {
    const [{ data: rows }, { data: items }] = await Promise.all([
      supabase
        .from('agenda_section_types')
        .select('*')
        .order('default_order', { ascending: true }),
      supabase.from('agenda_items').select('section_type_id'),
    ])
    const u = {}
    for (const it of items ?? []) {
      if (it.section_type_id)
        u[it.section_type_id] = (u[it.section_type_id] ?? 0) + 1
    }
    setUsage(u)
    setTypes(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function persistOrder(ordered) {
    setTypes(ordered)
    await Promise.all(
      ordered.map((t, i) =>
        supabase
          .from('agenda_section_types')
          .update({ default_order: i + 1 })
          .eq('id', t.id),
      ),
    )
    load()
  }

  function handleDrop(targetId) {
    const from = dragId
    setDragId(null)
    if (!from || from === targetId) return
    const ids = types.map((t) => t.id)
    const fromIdx = ids.indexOf(from)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const next = [...types]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    persistOrder(next)
  }

  async function addType() {
    const name = draft.name.trim()
    if (!name) return
    setAdding(true)
    const maxOrder = types.reduce((m, t) => Math.max(m, t.default_order), 0)
    const { error } = await supabase.from('agenda_section_types').insert({
      name,
      is_default: draft.is_default,
      default_order: maxOrder + 1,
    })
    setAdding(false)
    if (!error) {
      setDraft({ name: '', is_default: true })
      load()
    } else {
      window.alert(error.message)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <Card title="Section types" desc="Drag to reorder how sections appear on new agendas.">
        <div className="space-y-2">
          {types.map((t) => (
            <SectionTypeRow
              key={t.id}
              type={t}
              usedCount={usage[t.id] ?? 0}
              isDragging={dragId === t.id}
              onDragStart={() => setDragId(t.id)}
              onDrop={() => handleDrop(t.id)}
              onChanged={load}
            />
          ))}
        </div>
      </Card>

      <Card title="Add section type">
        <div className="flex flex-wrap items-end gap-3">
          <Labeled label="Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Guest Speaker"
              className={inputClass}
            />
          </Labeled>
          <label className="mb-2.5 flex items-center gap-2 text-sm text-gray-600">
            <Toggle
              checked={draft.is_default}
              onChange={(v) => setDraft((d) => ({ ...d, is_default: v }))}
            />
            Auto-populate on new agendas
          </label>
          <button
            onClick={addType}
            disabled={adding || !draft.name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </Card>
    </div>
  )
}

function SectionTypeRow({ type, usedCount, isDragging, onDragStart, onDrop, onChanged }) {
  const [name, setName] = useState(type.name)

  useEffect(() => {
    setName(type.name)
  }, [type])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === type.name) {
      setName(type.name)
      return
    }
    const { error } = await supabase
      .from('agenda_section_types')
      .update({ name: trimmed })
      .eq('id', type.id)
    if (error) {
      window.alert(error.message)
      setName(type.name)
    } else onChanged()
  }

  async function toggleDefault(next) {
    const { error } = await supabase
      .from('agenda_section_types')
      .update({ is_default: next })
      .eq('id', type.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  async function remove() {
    if (usedCount > 0) return
    if (!window.confirm(`Delete the "${type.name}" section type?`)) return
    const { error } = await supabase
      .from('agenda_section_types')
      .delete()
      .eq('id', type.id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-300" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        className={`${inputClass} flex-1`}
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <Toggle checked={type.is_default} onChange={toggleDefault} />
        Default
      </label>
      <button
        onClick={remove}
        disabled={usedCount > 0}
        title={usedCount > 0 ? `${usedCount} agenda item(s) use this` : 'Delete'}
        className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ═══════════════════════ Tab 6 — General ═══════════════════════ */
function GeneralTab() {
  return (
    <div className="space-y-6">
      <PurposeTextSection />
      <QuorumSection />
      <MeetingTitleSection />
      <NewsletterSection />
    </div>
  )
}

function PurposeTextSection() {
  const { settings, refresh } = useSiteSettings()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setText(settings.about_purpose_text ?? '')
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({ about_purpose_text: text })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  const dirty = settings && text !== (settings.about_purpose_text ?? '')

  return (
    <Card title="About page purpose" desc="Shown on the public About page.">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        rows={5}
        className={`${inputClass} resize-y`}
      />
      <div className="mt-3">
        <SaveButton onClick={save} saving={saving} saved={saved && !dirty} disabled={!dirty} />
      </div>
    </Card>
  )
}

function QuorumSection() {
  const { settings, refresh } = useSiteSettings()
  const [type, setType] = useState('half_active')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setType(settings.quorum_type ?? 'half_active')
      setCustom(settings.quorum_custom_value ?? '')
    }
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({
        quorum_type: type,
        quorum_custom_value:
          type === 'custom' ? Number(custom) || 0 : null,
      })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  const OPTIONS = [
    ['half_active', 'Half of active members'],
    ['half_officers', 'Half of elected officers'],
    ['custom', 'Custom number'],
  ]

  return (
    <Card title="Quorum" desc="How the quorum threshold is calculated in QR sessions.">
      <div className="space-y-2">
        {OPTIONS.map(([val, label]) => (
          <label
            key={val}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700"
          >
            <input
              type="radio"
              name="quorum"
              checked={type === val}
              onChange={() => {
                setType(val)
                setSaved(false)
              }}
              className="h-4 w-4 text-maroon focus:ring-maroon/30"
            />
            {label}
          </label>
        ))}
        {type === 'custom' && (
          <input
            type="number"
            min={0}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setSaved(false)
            }}
            placeholder="Members needed"
            className={`${inputClass} mt-1 w-48`}
          />
        )}
      </div>
      <div className="mt-4">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </Card>
  )
}

function MeetingTitleSection() {
  const { settings, refresh } = useSiteSettings()
  const [format, setFormat] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings)
      setFormat(settings.default_meeting_title_format ?? 'SGA Meeting – {date}')
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({ default_meeting_title_format: format })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <Card
      title="Default meeting title"
      desc="Used to prefill the title when creating a meeting. Use {date} for the date."
    >
      <input
        value={format}
        onChange={(e) => {
          setFormat(e.target.value)
          setSaved(false)
        }}
        className={inputClass}
        placeholder="SGA Meeting – {date}"
      />
      <p className="mt-2 text-xs text-gray-400">
        Preview: {meetingTitleFromFormat(format, todayISO())}
      </p>
      <div className="mt-3">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </Card>
  )
}

function NewsletterSection() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('newsletter_emails')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEmails(data ?? [])
        setLoading(false)
      })
  }, [])

  function exportCsv() {
    const header = 'email,created_at\n'
    const rows = emails
      .map((e) => `${csvCell(e.email)},${csvCell(e.created_at)}`)
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `newsletter-emails-${todayISO()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card
      title="Newsletter emails"
      desc={loading ? 'Loading…' : `${emails.length} collected`}
    >
      <div className="flex justify-end">
        <button
          onClick={exportCsv}
          disabled={emails.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>
      <div className="mt-4">
        {loading ? (
          <Loading />
        ) : emails.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No emails collected yet.
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {emails.map((e) => (
              <li
                key={e.email}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
              >
                <span className="truncate text-gray-900">{e.email}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/* ───────────────────────── misc ───────────────────────── */
function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-7 w-7 animate-spin text-maroon" />
    </div>
  )
}
