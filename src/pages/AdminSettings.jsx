import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Palette,
  ShieldCheck,
  Award,
  ClipboardList,
  ListChecks,
  CalendarDays,
  Settings2,
  Loader2,
  Check,
  Plus,
  Trash2,
  Upload,
  GripVertical,
  Lock,
  Download,
  Megaphone,
  FileText,
  Mail,
  MapPin,
  UsersRound,
  UserPlus,
  UserCheck,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { meetingTitleFromFormat, todayISO } from '../lib/format.js'

// The fixed permission set, in the order the plan lists them. Used by the
// Permission Tiers section.
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

// The panel is organized into grouped sections. Each section declares the
// permission key it needs; the sidebar only shows what the viewer can use, so
// an `edit_site`-only officer sees the Public Site group while a full admin
// sees everything. Order here is the order shown in the sidebar.
const NAV_GROUPS = [
  {
    group: 'Public Site',
    items: [
      { key: 'announcements', label: 'Announcements', icon: Megaphone, perm: 'edit_site' },
      { key: 'join', label: 'Join SGA', icon: ClipboardList, perm: 'edit_site' },
      { key: 'about', label: 'About Page', icon: FileText, perm: 'edit_site' },
      { key: 'calendar', label: 'Calendar', icon: CalendarDays, perm: 'edit_site' },
      { key: 'contact', label: 'Contact Info', icon: MapPin, perm: 'edit_site' },
      { key: 'newsletter', label: 'Newsletter', icon: Mail, perm: 'edit_site' },
    ],
  },
  {
    group: 'Appearance',
    items: [
      { key: 'branding', label: 'Branding', icon: Palette, perm: 'manage_roles' },
    ],
  },
  {
    group: 'People & Access',
    items: [
      { key: 'members', label: 'Members & Roles', icon: UsersRound, perm: 'manage_roles' },
      { key: 'tiers', label: 'Permission Tiers', icon: ShieldCheck, perm: 'manage_roles' },
      { key: 'positions', label: 'Elected Positions', icon: Award, perm: 'manage_roles' },
    ],
  },
  {
    group: 'Meetings',
    items: [
      { key: 'sections', label: 'Agenda Sections', icon: ListChecks, perm: 'manage_roles' },
      { key: 'meetings', label: 'Meeting Defaults', icon: Settings2, perm: 'manage_roles' },
    ],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export default function AdminSettings() {
  const { loading, session, hasPermission } = useAuth()
  const navigate = useNavigate()

  // Anyone with at least one admin-area permission may open the panel; the
  // sidebar then narrows to the sections they can actually use.
  const visible = ALL_ITEMS.filter((i) => hasPermission(i.perm))

  useEffect(() => {
    if (!loading && !session) navigate('/login?redirect=/dashboard/admin', { replace: true })
  }, [loading, session, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </div>
    )
  }

  if (!session) return null

  if (visible.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Navbar />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
          <Lock className="h-10 w-10 text-maroon" />
          <h1 className="mt-4 font-display text-2xl font-bold text-maroon">
            Access restricted
          </h1>
          <p className="mt-2 text-gray-600">
            Your account doesn't have access to the admin panel. Ask an admin to
            upgrade your clearance level.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-lg bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-maroon-dark"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <AdminContent visible={visible} />
}

function AdminContent({ visible }) {
  const navigate = useNavigate()
  const { section } = useParams()
  const visibleKeys = visible.map((i) => i.key)

  // Resolve the active section from the URL, falling back to the first one the
  // viewer is allowed to see if the slug is missing or off-limits.
  const active = visibleKeys.includes(section) ? section : visibleKeys[0]
  const activeItem = ALL_ITEMS.find((i) => i.key === active)

  // Keep the URL in step so deep links and refreshes land on the same section.
  useEffect(() => {
    if (section !== active) {
      navigate(`/dashboard/admin/${active}`, { replace: true })
    }
  }, [section, active, navigate])

  function go(key) {
    navigate(`/dashboard/admin/${key}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Admin Panel
            </h1>
            <p className="mt-1 text-gray-500">
              One place for the public site, members, branding, and settings.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        {/* Mobile section picker */}
        <div className="mt-6 lg:hidden">
          <select
            value={active}
            onChange={(e) => go(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-maroon shadow-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
          >
            {NAV_GROUPS.map((grp) => {
              const items = grp.items.filter((i) => visibleKeys.includes(i.key))
              if (items.length === 0) return null
              return (
                <optgroup key={grp.group} label={grp.group}>
                  {items.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-6 space-y-6">
              {NAV_GROUPS.map((grp) => {
                const items = grp.items.filter((i) =>
                  visibleKeys.includes(i.key),
                )
                if (items.length === 0) return null
                return (
                  <div key={grp.group}>
                    <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                      {grp.group}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon
                        const on = item.key === active
                        return (
                          <button
                            key={item.key}
                            onClick={() => go(item.key)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                              on
                                ? 'bg-maroon text-white shadow-sm'
                                : 'text-gray-600 hover:bg-maroon/5 hover:text-maroon'
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>
          </aside>

          {/* Active section */}
          <div className="min-w-0">
            <div className="mb-5 flex items-center gap-2.5">
              {activeItem && (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
                  <activeItem.icon className="h-5 w-5" />
                </span>
              )}
              <h2 className="font-display text-xl font-bold text-maroon">
                {activeItem?.label}
              </h2>
            </div>

            {active === 'announcements' && <AnnouncementsSection />}
            {active === 'join' && <JoinSection />}
            {active === 'about' && <AboutSection />}
            {active === 'calendar' && <CalendarSection />}
            {active === 'contact' && <ContactSection />}
            {active === 'newsletter' && <NewsletterSection />}
            {active === 'branding' && <BrandingTab />}
            {active === 'members' && <MembersSection />}
            {active === 'tiers' && <TiersTab />}
            {active === 'positions' && <PositionsTab />}
            {active === 'sections' && <SectionTypesTab />}
            {active === 'meetings' && <MeetingDefaultsSection />}
          </div>
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
            <h2 className="font-display text-lg font-bold text-maroon">
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
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

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

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-maroon">
        {label}
      </span>
      {children}
    </label>
  )
}

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-7 w-7 animate-spin text-maroon" />
    </div>
  )
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/* ═══════════════════════ Public Site — Announcements ═══════════════════════ */
function AnnouncementsSection() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('announcements').insert({
      title: t,
      body: body.trim(),
      created_by: profile?.id ?? null,
    })
    setSaving(false)
    if (insertError) {
      setError('Could not create the announcement. Please try again.')
      return
    }
    setTitle('')
    setBody('')
    load()
  }

  async function togglePublish(item) {
    setItems((prev) =>
      prev.map((a) =>
        a.id === item.id ? { ...a, is_published: !a.is_published } : a,
      ),
    )
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (updateError) load()
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setItems((prev) => prev.filter((a) => a.id !== item.id))
    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', item.id)
    if (deleteError) load()
  }

  return (
    <Card
      title="Announcements"
      desc="Published announcements appear on the homepage, newest first."
    >
      <form onSubmit={handleCreate} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write the announcement…"
          rows={3}
          className={`${inputClass} resize-y`}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add announcement
        </button>
      </form>

      <div className="mt-6 border-t border-gray-100 pt-5">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No announcements yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-maroon">
                      {item.title}
                    </p>
                    {item.is_published ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Draft
                      </span>
                    )}
                  </div>
                  {item.body && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {item.body}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => togglePublish(item)}
                    title={item.is_published ? 'Unpublish' : 'Publish'}
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
                  >
                    {item.is_published ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => remove(item)}
                    title="Delete"
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

/* ═══════════════════════ Public Site — Join SGA ═══════════════════════ */
// Combines the signup on/off switch with the dynamic form builder so everything
// that controls the Join SGA page lives in one section.
function JoinSection() {
  return (
    <div className="space-y-6">
      <SignupToggleCard />
      <JoinFormBuilder />
    </div>
  )
}

function SignupToggleCard() {
  const { settings, refresh } = useSiteSettings()
  const [saving, setSaving] = useState(false)
  const enabled = settings?.signup_enabled ?? false

  async function toggle() {
    setSaving(true)
    const { error } = await supabase
      .from('site_settings')
      .update({ signup_enabled: !enabled })
      .eq('id', 1)
    if (!error) await refresh()
    setSaving(false)
  }

  return (
    <Card
      title="Signups"
      desc="Controls whether the public Join SGA form is open."
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-maroon">
            Signups are currently{' '}
            <span className={enabled ? 'text-green-600' : 'text-gray-500'}>
              {enabled ? 'open' : 'closed'}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            {enabled
              ? 'Students can submit the Join SGA application.'
              : 'The Join SGA page is hidden and redirects home.'}
          </p>
        </div>
        <Toggle checked={enabled} onChange={toggle} disabled={saving} />
      </div>
    </Card>
  )
}

// Core fields are always present and locked; they are not stored in the schema.
const CORE_FIELDS = [
  'Full Name',
  'Student ID',
  'Email',
  'Password',
  'Confirm Password',
  'Applying as candidate?',
]

function JoinFormBuilder() {
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
    <div className="grid gap-6 xl:grid-cols-2">
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
                      <span className="truncate text-sm font-medium text-maroon">
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
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-maroon hover:bg-gray-50"
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
      <div className="xl:sticky xl:top-6 xl:self-start">
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

/* ═══════════════════════ Public Site — About Page ═══════════════════════ */
function AboutSection() {
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
    <Card
      title="Purpose text"
      desc="The purpose statement shown on the public About page."
    >
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        rows={6}
        placeholder="Describe the purpose of the SGA…"
        className={`${inputClass} resize-y`}
      />
      <div className="mt-3">
        <SaveButton
          onClick={save}
          saving={saving}
          saved={saved && !dirty}
          disabled={!dirty}
        />
      </div>
    </Card>
  )
}

/* ═══════════════════════ Public Site — Calendar ═══════════════════════ */
// The Google Calendar embed shown in the homepage "Upcoming Events" panel. The
// admin pastes the calendar's embed URL (Google Calendar → Settings → Integrate
// calendar → "Embed code", the src="…" value) so it can be repointed without a
// deploy.
function CalendarSection() {
  const { settings, refresh } = useSiteSettings()
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setUrl(settings.calendar_url ?? '')
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({ calendar_url: url.trim() })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  const dirty = settings && url !== (settings.calendar_url ?? '')

  return (
    <Card
      title="Homepage calendar"
      desc="The Google Calendar embedded in the “Upcoming Events” panel on the homepage."
    >
      <div className="grid gap-5">
        <Labeled label="Calendar embed URL">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setSaved(false)
            }}
            placeholder="https://calendar.google.com/calendar/embed?src=…"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-gray-500">
            In Google Calendar: Settings → your calendar → “Integrate calendar” →
            copy the <code>src="…"</code> URL from the Embed code.
          </p>
        </Labeled>
        {url.trim() && (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <iframe
              title="Calendar preview"
              src={url.trim()}
              className="h-72 w-full"
              style={{ border: 0 }}
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
      </div>
      <div className="mt-4">
        <SaveButton
          onClick={save}
          saving={saving}
          saved={saved && !dirty}
          disabled={!dirty}
        />
      </div>
    </Card>
  )
}

/* ═══════════════════════ Public Site — Contact Info ═══════════════════════ */
// Email + mailing address shown in the site footer. Both live in site_settings
// so they can be updated without a deploy.
function ContactSection() {
  const { settings, refresh } = useSiteSettings()
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setEmail(settings.contact_email ?? '')
      setAddress(settings.contact_address ?? '')
    }
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({
        contact_email: email.trim(),
        contact_address: address.trim(),
      })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  const dirty =
    settings &&
    (email !== (settings.contact_email ?? '') ||
      address !== (settings.contact_address ?? ''))

  return (
    <Card
      title="Contact details"
      desc="The email and address shown in the site footer."
    >
      <div className="grid gap-5">
        <Labeled label="Contact email">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setSaved(false)
            }}
            placeholder="sga@pensacolahigh.edu"
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Mailing address">
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setSaved(false)
            }}
            placeholder="500 W Maxwell St, Pensacola, FL 32501"
            className={inputClass}
          />
        </Labeled>
      </div>
      <div className="mt-4">
        <SaveButton
          onClick={save}
          saving={saving}
          saved={saved && !dirty}
          disabled={!dirty}
        />
      </div>
    </Card>
  )
}

/* ═══════════════════════ Public Site — Newsletter ═══════════════════════ */
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
      desc={loading ? 'Loading…' : `${emails.length} collected from the footer signup`}
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
                <span className="truncate text-maroon">{e.email}</span>
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

/* ═══════════════════════ Appearance — Branding ═══════════════════════ */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function BrandingTab() {
  const { settings, refresh } = useSiteSettings()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

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
      await refresh()
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
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-gray-50"
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

function expandHex(hex) {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return '#' + hex.slice(1).split('').map((c) => c + c).join('')
  }
  return hex
}

/* ═══════════════════════ People — Members & Roles ═══════════════════════ */
// Mirrors clearanceForRole in Profile.jsx so the legacy clearance_level stays in
// sync with role_id while the app still reads clearance_level in places.
function clearanceForRole(role) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

function MembersSection() {
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

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <CreateAccountCard roles={roles} onChanged={load} />
      <PendingCard pending={pending} roles={roles} onChanged={load} />
      <RolesCard members={active} roles={roles} onChanged={load} />
    </div>
  )
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

function CreateAccountCard({ roles, onChanged }) {
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

function PendingCard({ pending, roles, onChanged }) {
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
    </Card>
  )
}

function RolesCard({ members, roles, onChanged }) {
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
    <Card
      title="Member roles"
      desc="The only place a member's role is changed. Admin-tier members are locked."
    >
      {members.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No members yet.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
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
    </Card>
  )
}

/* ═══════════════════════ People — Permission Tiers ═══════════════════════ */
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

/* ═══════════════════════ People — Elected Positions ═══════════════════════ */
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

/* ═══════════════════════ Meetings — Agenda Section Types ═══════════════════════ */
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

/* ═══════════════════════ Meetings — Defaults (quorum + title) ═══════════════════════ */
function MeetingDefaultsSection() {
  return (
    <div className="space-y-6">
      <QuorumCard />
      <MeetingTitleCard />
    </div>
  )
}

function QuorumCard() {
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
        quorum_custom_value: type === 'custom' ? Number(custom) || 0 : null,
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
            className="flex cursor-pointer items-center gap-2.5 text-sm text-maroon"
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

function MeetingTitleCard() {
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
