import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Archive,
  Folder,
  FolderOpen,
  Tag,
  Upload,
  FileText,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import supabase from '../lib/supabaseClient.js'

export default function Archives() {
  return (
    <RequireAuth>
      <ArchivesContent />
    </RequireAuth>
  )
}

function ArchivesContent() {
  const { profile, hasPermission } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState(null) // selected folder prefix, null = all
  const [activeTags, setActiveTags] = useState([]) // multi-select tag filter

  // Items the viewer is allowed to manage (own uploads, or archive admin).
  const canManage = (item) =>
    hasPermission('manage_committees') || item.uploaded_by === profile?.id

  async function load() {
    // Never select file_url — its presence is exposed via the has_file flag and
    // files are opened through server-signed URLs. RLS scopes rows to the
    // viewer's tier, so no client-side visibility filtering is needed.
    const { data } = await supabase
      .from('archive_items')
      .select(
        'id, title, description, category, tags, folder_path, has_file, drive_link, visibility_min_role_order, uploaded_by, created_at, uploader:profiles!archive_items_uploaded_by_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Folder hierarchy derived from folder_path values ("2025/Minutes").
  const folders = useMemo(() => buildFolderTree(items), [items])
  const allTags = useMemo(() => {
    const set = new Set()
    items.forEach((i) => (i.tags ?? []).forEach((t) => set.add(t)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const visible = useMemo(() => {
    return items.filter((i) => {
      // Folder match: exact folder or any descendant of the selected prefix.
      if (folder != null) {
        const path = i.folder_path ?? ''
        if (path !== folder && !path.startsWith(folder + '/')) return false
      }
      // Tag match: item must carry every selected tag.
      if (activeTags.length) {
        const tags = i.tags ?? []
        if (!activeTags.every((t) => tags.includes(t))) return false
      }
      return true
    })
  }, [items, folder, activeTags])

  function toggleTag(tag) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Archives
            </h1>
            <p className="mt-1 text-gray-500">
              Documents, minutes and resources, organized by folder and tag.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
          {/* Sidebar: folder tree + tag filter */}
          <aside className="space-y-6">
            <FolderTree
              folders={folders}
              selected={folder}
              onSelect={setFolder}
              total={items.length}
            />
            <TagFilter
              tags={allTags}
              active={activeTags}
              onToggle={toggleTag}
              onClear={() => setActiveTags([])}
            />
          </aside>

          {/* Main: upload panel + item list */}
          <div className="space-y-6">
            {hasPermission('upload_archives') && (
              <UploadPanel
                folders={folders.allPaths}
                onUploaded={load}
              />
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-maroon" />
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
                <Archive className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm text-gray-400">
                  {items.length === 0
                    ? 'No archive items yet.'
                    : 'No items match these filters.'}
                </p>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {visible.map((item) => (
                  <ArchiveCard
                    key={item.id}
                    item={item}
                    canManage={canManage(item)}
                    onDeleted={load}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

// ─────────────────────────── Folder tree ───────────────────────────
// Build a nested tree from "a/b/c" folder_path strings.
function buildFolderTree(items) {
  const root = {}
  const allPaths = new Set()
  for (const item of items) {
    const path = (item.folder_path ?? '').trim()
    if (!path) continue
    const parts = path.split('/').filter(Boolean)
    let node = root
    let prefix = ''
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part
      allPaths.add(prefix)
      node[part] = node[part] ?? { __path: prefix, __children: {} }
      node = node[part].__children
    }
  }
  return { root, allPaths: [...allPaths].sort() }
}

function FolderTree({ folders, selected, onSelect, total }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-gray-700">
          Folders
        </h2>
      </div>
      <div className="p-2">
        <FolderRow
          label="All items"
          icon={selected == null ? FolderOpen : Folder}
          active={selected == null}
          depth={0}
          count={total}
          onClick={() => onSelect(null)}
        />
        <FolderNodes
          node={folders.root}
          depth={0}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </section>
  )
}

function FolderNodes({ node, depth, selected, onSelect }) {
  const keys = Object.keys(node).sort((a, b) => a.localeCompare(b))
  return keys.map((key) => {
    const entry = node[key]
    const active = selected === entry.__path
    const hasChildren = Object.keys(entry.__children).length > 0
    return (
      <div key={entry.__path}>
        <FolderRow
          label={key}
          icon={active ? FolderOpen : Folder}
          active={active}
          depth={depth}
          onClick={() => onSelect(active ? null : entry.__path)}
        />
        {hasChildren && (
          <FolderNodes
            node={entry.__children}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        )}
      </div>
    )
  })
}

function FolderRow({ label, icon: Icon, active, depth, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition ${
        active
          ? 'bg-maroon/10 font-semibold text-maroon'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {count != null && (
        <span className="ml-auto text-xs text-gray-400">{count}</span>
      )}
    </button>
  )
}

// ─────────────────────────── Tag filter ───────────────────────────
function TagFilter({ tags, active, onToggle, onClear }) {
  if (tags.length === 0) return null
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-gray-700">
          Tags
        </h2>
        {active.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-gray-400 hover:text-maroon"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        {tags.map((tag) => {
          const on = active.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => onToggle(tag)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                on
                  ? 'bg-maroon text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Tag className="h-3 w-3" />
              {tag}
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ─────────────────────────── Item card ───────────────────────────
function ArchiveCard({ item, canManage, onDeleted }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function openFile() {
    setOpening(true)
    setError('')
    // Signed URL is minted on demand, never pre-fetched. Open a tab synchronously
    // so the eventual navigation isn't treated as a popup.
    const tab = window.open('', '_blank')
    const { data, error: fnError } = await supabase.functions.invoke(
      'archive-file-url',
      { body: { item_id: item.id } },
    )
    setOpening(false)
    if (fnError || !data?.url) {
      if (tab) tab.close()
      setError('Could not open this file.')
      return
    }
    if (tab) tab.location = data.url
    else window.open(data.url, '_blank')
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const { error: delError } = await supabase
      .from('archive_items')
      .delete()
      .eq('id', item.id)
    setDeleting(false)
    if (delError) {
      setError('Could not delete this item.')
      return
    }
    onDeleted()
  }

  return (
    <li className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-gray-900">{item.title}</h3>
          {item.category && (
            <span className="mt-1 inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-maroon">
              {item.category}
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={remove}
            disabled={deleting}
            title="Delete"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {item.description && (
        <p className="mt-2 text-sm text-gray-600">{item.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        {item.folder_path && (
          <span className="inline-flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {item.folder_path}
          </span>
        )}
        {(item.tags ?? []).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-xs text-gray-400">
          {item.uploader?.full_name ?? 'Unknown'} ·{' '}
          {new Date(item.created_at).toLocaleDateString()}
        </p>
        {item.has_file ? (
          <button
            onClick={openFile}
            disabled={opening}
            className="inline-flex items-center gap-1.5 rounded-lg bg-maroon px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-60"
          >
            {opening ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Open file
          </button>
        ) : (
          <a
            href={item.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-maroon px-3.5 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
          >
            <ExternalLink className="h-4 w-4" />
            Open link
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  )
}

// ─────────────────────────── Upload panel ───────────────────────────
function UploadPanel({ folders, onUploaded }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [file, setFile] = useState(null)
  const [visibility, setVisibility] = useState(null) // role.order value
  const [roleOptions, setRoleOptions] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const myOrder = profile?.role?.order ?? 0

  // Visibility options: roles at or below the uploader's own tier — they can
  // only restrict down to their level, never hide from tiers above them.
  useEffect(() => {
    supabase
      .from('roles')
      .select('name, order')
      .lte('order', myOrder)
      .order('order', { ascending: true })
      .then(({ data }) => {
        const opts = data ?? []
        setRoleOptions(opts)
        // Default to the lowest tier (most open) that can still see it.
        setVisibility(opts.length ? opts[0].order : 0)
      })
  }, [myOrder])

  function reset() {
    setTitle('')
    setDescription('')
    setCategory('')
    setTagsInput('')
    setFolderPath('')
    setDriveLink('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const t = title.trim()
    if (!t) return
    const link = driveLink.trim()
    // Exactly one source — matches the DB check constraint.
    if (file && link) {
      setError('Choose either a file or a Drive link, not both.')
      return
    }
    if (!file && !link) {
      setError('Add a file or a Drive link.')
      return
    }

    setSaving(true)
    let filePath = null

    if (file) {
      // Store under the uploader's id so object ownership/cleanup is scoped.
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      filePath = `${profile.id}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('archives')
        .upload(filePath, file, { upsert: false })
      if (uploadError) {
        setSaving(false)
        setError('File upload failed. Please try again.')
        return
      }
    }

    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const { error: insertError } = await supabase.from('archive_items').insert({
      title: t,
      description: description.trim(),
      category: category.trim(),
      tags,
      folder_path: folderPath.trim().replace(/^\/+|\/+$/g, ''),
      file_url: filePath,
      drive_link: filePath ? null : link,
      visibility_min_role_order: visibility ?? 0,
      uploaded_by: profile.id,
    })

    setSaving(false)
    if (insertError) {
      // Roll back the orphaned upload if the row insert failed.
      if (filePath) await supabase.storage.from('archives').remove([filePath])
      setError('Could not save the item. Please try again.')
      return
    }
    reset()
    setOpen(false)
    onUploaded()
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
      >
        <Upload className="h-4 w-4" /> Upload to Archives
      </button>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-maroon/10 text-maroon">
            <Upload className="h-5 w-5" />
          </span>
          <h2 className="font-display text-lg font-bold text-gray-900">
            Upload to Archives
          </h2>
        </div>
        <button
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4 p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={inputClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={`${inputClass} resize-y`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className={inputClass}
          />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (comma-separated)"
            className={inputClass}
          />
        </div>

        <div>
          <input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Folder path (e.g. 2025/Minutes)"
            list="archive-folder-options"
            className={inputClass}
          />
          <datalist id="archive-folder-options">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        {/* Source: file OR Drive link — selecting one disables the other. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <FileText className="h-3.5 w-3.5" /> File upload
            </label>
            <input
              ref={fileRef}
              type="file"
              disabled={Boolean(driveLink.trim())}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-maroon/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-maroon hover:file:bg-maroon/20 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <LinkIcon className="h-3.5 w-3.5" /> Drive link
            </label>
            <input
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={Boolean(file)}
              placeholder="https://drive.google.com/…"
              className={`${inputClass} disabled:opacity-50`}
            />
          </div>
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

        <div className="flex items-center gap-3">
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
            Add to Archives
          </button>
        </div>
      </form>
    </section>
  )
}
