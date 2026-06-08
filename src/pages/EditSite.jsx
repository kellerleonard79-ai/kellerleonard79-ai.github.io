import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Megaphone,
  ToggleLeft,
  ToggleRight,
  FileText,
  Mail,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Download,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequirePermission from '../components/RequirePermission.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'

export default function EditSite() {
  return (
    <RequirePermission permission="edit_site">
      <EditSiteContent />
    </RequirePermission>
  )
}

function EditSiteContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Edit Public Site
            </h1>
            <p className="mt-1 text-gray-500">
              Manage announcements, signups, and the About page.
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
          <AnnouncementsSection />
          <SignupToggleSection />
          <AboutTextSection />
          <NewsletterSection />
        </div>
      </div>
      <Footer />
    </div>
  )
}

// Shared card chrome so every section looks consistent.
function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">{title}</h2>
          {desc && <p className="text-sm text-gray-500">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ───────────────────────── 1. Announcements ─────────────────────────
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
    // Optimistic flip, reconcile on response.
    setItems((prev) =>
      prev.map((a) =>
        a.id === item.id ? { ...a, is_published: !a.is_published } : a,
      ),
    )
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (updateError) load() // revert to truth on failure
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
    <Section
      icon={Megaphone}
      title="Announcements"
      desc="Published announcements appear on the homepage."
    >
      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
          className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write the announcement…"
          rows={3}
          className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
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

      {/* List */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-maroon" />
          </div>
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
                    <p className="truncate font-semibold text-gray-900">
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
    </Section>
  )
}

// ───────────────────────── 2. Join SGA toggle ─────────────────────────
function SignupToggleSection() {
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
    <Section
      icon={enabled ? ToggleRight : ToggleLeft}
      title="Join SGA Signups"
      desc="Controls whether the public Join SGA form is open."
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900">
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
        <button
          onClick={toggle}
          disabled={saving}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
            enabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </Section>
  )
}

// ───────────────────────── 3. About page text ─────────────────────────
function AboutTextSection() {
  const { settings, refresh } = useSiteSettings()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Seed the textarea once settings arrive.
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
    <Section
      icon={FileText}
      title="About Page Purpose"
      desc="The purpose text shown on the public About page."
    >
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
        }}
        rows={5}
        placeholder="Describe the purpose of the SGA…"
        className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </Section>
  )
}

// ───────────────────────── 4. Newsletter emails ─────────────────────────
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
    link.download = `newsletter-emails-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section
      icon={Mail}
      title="Newsletter Emails"
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
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-maroon" />
          </div>
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
    </Section>
  )
}

// Escape a value for CSV: wrap in quotes and double internal quotes when it
// contains a comma, quote, or newline.
function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
