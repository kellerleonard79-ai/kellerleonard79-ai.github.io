import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import RequirePermission from '../components/RequirePermission.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'
import { todayISO } from '../lib/format.js'
import {
  Card,
  Labeled,
  Loading,
  SaveButton,
  Toggle,
  csvCell,
  inputClass,
} from '../components/ui.jsx'

// Edit Site — what remains of the old Admin Panel once every section that
// belonged to a dashboard tool moved onto that tool's own page (members and
// tiers to Member Directory, positions and candidacy to SGA Elections, agenda
// sections and meeting defaults to Meetings, homecoming to Court Elections).
// What's left is exactly the public-facing site content, under one permission.
const SECTIONS = [
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'join', label: 'Join SGA', icon: ClipboardList },
  { key: 'about', label: 'About Page', icon: FileText },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'contact', label: 'Contact Info', icon: MapPin },
  { key: 'newsletter', label: 'Newsletter', icon: Mail },
]

export default function EditSite() {
  return (
    <RequirePermission permission="edit_site">
      <EditSiteContent />
    </RequirePermission>
  )
}

function EditSiteContent() {
  const navigate = useNavigate()
  const { section } = useParams()

  // Resolve the active section from the URL, falling back to the first one when
  // the slug is missing or unrecognized.
  const active = SECTIONS.some((s) => s.key === section)
    ? section
    : SECTIONS[0].key
  const activeItem = SECTIONS.find((s) => s.key === active)

  // Keep the URL in step so deep links and refreshes land on the same section.
  useEffect(() => {
    if (section !== active) {
      navigate(`/dashboard/edit-site/${active}`, { replace: true })
    }
  }, [section, active, navigate])

  function go(key) {
    navigate(`/dashboard/edit-site/${key}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-maroon">
              Edit Site
            </h1>
            <p className="mt-1 text-gray-500">
              Everything the public sees: announcements, the Join form, and page
              content.
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
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-6 space-y-0.5">
              {SECTIONS.map((item) => {
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
          </div>
        </div>
      </div>
    </div>
  )
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
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

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

  function startEdit(item) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditBody(item.body ?? '')
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(item) {
    const t = editTitle.trim()
    if (!t) return
    setEditSaving(true)
    setEditError('')
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ title: t, body: editBody.trim(), updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setEditSaving(false)
    if (updateError) {
      setEditError('Could not save changes. Please try again.')
      return
    }
    setEditingId(null)
    load()
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
            {items.map((item) =>
              editingId === item.id ? (
                <li
                  key={item.id}
                  className="rounded-xl border border-maroon/30 bg-maroon/5 p-4"
                >
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Announcement title"
                      className={inputClass}
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Write the announcement…"
                      rows={3}
                      className={`${inputClass} resize-y`}
                    />
                    {editError && (
                      <p className="text-xs text-red-600">{editError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveEdit(item)}
                        disabled={editSaving || !editTitle.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={editSaving}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              ) : (
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
                      onClick={() => startEdit(item)}
                      title="Edit"
                      className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
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
              ),
            )}
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
      <ConstitutionCard />
      <JoinFormBuilder />
    </div>
  )
}

// Lets an editor set the SGA constitution applicants can read before joining —
// either by pasting a link or uploading a file. Both resolve to a single public
// URL stored on site_settings.constitution_url.
function ConstitutionCard() {
  const { settings, refresh } = useSiteSettings()
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // Seed the input once settings load; the saved value lives in `settings`.
  useEffect(() => {
    if (settings) setUrl(settings.constitution_url ?? '')
  }, [settings])

  const current = settings?.constitution_url ?? ''
  const dirty = url.trim() !== current

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    // Upload via the upload-document Edge Function rather than the browser
    // Storage client. The documents bucket's INSERT policy gates on
    // has_permission('edit_site'), but the Storage API processes the browser's
    // request as anon (it doesn't honor the user JWT here), so a direct
    // supabase.storage upload is rejected by RLS even for admins. The function
    // verifies edit_site via GoTrue, then writes with the service role.
    const formData = new FormData()
    formData.append('file', file)
    const { data, error: fnError } = await supabase.functions.invoke(
      'upload-document',
      { body: formData },
    )
    if (fnError || data?.error) {
      // On a non-2xx the real message is in the error's Response body, not data.
      let msg = data?.error ?? fnError?.message ?? 'Unknown error'
      try {
        const body = await fnError?.context?.json()
        if (body?.error) msg = body.error
      } catch {
        // keep msg
      }
      setError(`Upload failed: ${msg}`)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUrl(data.url)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    // Persist immediately: an admin who uploads a file expects it to take
    // effect, not to also have to click Save afterward.
    await save(data.url)
  }

  // `override` lets handleUpload save the freshly uploaded URL without waiting on
  // a state update; manual Save calls fall back to the input value.
  async function save(override) {
    const value = (override ?? url).trim() || null
    setSaving(true)
    setSaved(false)
    setError('')
    const { error: upErr } = await supabase
      .from('site_settings')
      .update({ constitution_url: value })
      .eq('id', 1)
    if (upErr) {
      setError(`Could not save: ${upErr.message}`)
    } else {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <Card
      title="SGA Constitution"
      desc="Shown to applicants on the Join SGA page. Paste a link or upload a file (e.g. a PDF)."
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <Labeled label="Link or uploaded file URL">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setSaved(false)
            }}
            placeholder="https://…"
            className={inputClass}
          />
        </Labeled>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            onChange={handleUpload}
            className="hidden"
            id="constitution-upload"
          />
          <label
            htmlFor="constitution-upload"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-gray-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload file
          </label>
          {current && (
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-gray-50"
            >
              <FileText className="h-4 w-4" /> Preview current
            </a>
          )}
          <div className="ml-auto flex items-center gap-3">
            {saved && !dirty && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
            <button
              onClick={() => save()}
              disabled={saving || uploading || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </Card>
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
  const [socials, setSocials] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setEmail(settings.contact_email ?? '')
      setAddress(settings.contact_address ?? '')
      setSocials(
        Array.isArray(settings.footer_socials)
          ? settings.footer_socials.map((s) => ({
              label: s.label ?? '',
              href: s.href ?? '',
            }))
          : [],
      )
    }
  }, [settings])

  function updateSocial(i, field, value) {
    setSocials((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    )
    setSaved(false)
  }

  function addSocial() {
    setSocials((prev) => [...prev, { label: '', href: 'https://instagram.com/' }])
    setSaved(false)
  }

  function removeSocial(i) {
    setSocials((prev) => prev.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const cleanedSocials = socials
      .map((s) => ({ label: s.label.trim(), href: s.href.trim() }))
      .filter((s) => s.label || s.href)
    const { error } = await supabase
      .from('site_settings')
      .update({
        contact_email: email.trim(),
        contact_address: address.trim(),
        footer_socials: cleanedSocials,
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
      address !== (settings.contact_address ?? '') ||
      JSON.stringify(socials) !==
        JSON.stringify(
          Array.isArray(settings.footer_socials)
            ? settings.footer_socials.map((s) => ({
                label: s.label ?? '',
                href: s.href ?? '',
              }))
            : [],
        ))

  return (
    <Card
      title="Contact details"
      desc="The email, address, and social links shown in the site footer."
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
        <Labeled label="Footer social links">
          <div className="grid gap-2.5">
            {socials.length === 0 && (
              <p className="text-sm text-gray-400">No social links yet.</p>
            )}
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => updateSocial(i, 'label', e.target.value)}
                  placeholder="Class of '27"
                  className={`${inputClass} sm:w-40 sm:flex-none`}
                />
                <input
                  type="url"
                  value={s.href}
                  onChange={(e) => updateSocial(i, 'href', e.target.value)}
                  placeholder="https://instagram.com/handle"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  aria-label="Remove link"
                  className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-400 transition hover:border-red-300 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSocial}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-maroon px-3 py-1.5 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
            >
              <Plus className="h-4 w-4" /> Add link
            </button>
          </div>
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

