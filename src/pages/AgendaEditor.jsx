import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Loader2,
  FileDown,
  Eye,
  Pencil,
  Paperclip,
  Link2,
  Upload,
  FileText,
  Archive,
  ExternalLink,
  Lock,
  X,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { formatDate, formatTime } from '../lib/format.js'

const STATUS_OPTIONS = [
  'No status',
  'In progress',
  'Approved',
  'Tabled',
  'Failed',
  'Carried',
]

// Legacy free-text section keys still satisfy the NOT NULL `section` column on
// agenda_items. The section type FK (section_type_id) is the source of truth;
// `section` is kept in sync for backward compatibility. Known default types map
// to their original keys; any custom type slugifies its name.
const NAME_TO_LEGACY_KEY = {
  Opening: 'opening',
  Announcements: 'announcements',
  Reports: 'reports',
  'Unfinished Business': 'unfinished',
  'New Business': 'new',
  'Open Floor': 'open_floor',
  Adjournment: 'adjournment',
}

function legacyKeyFor(name) {
  return (
    NAME_TO_LEGACY_KEY[name] ??
    name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  )
}

// Reverse of NAME_TO_LEGACY_KEY, for resolving older items that only carry the
// legacy `section` string (no section_type_id) back to a type name.
const LEGACY_KEY_TO_NAME = Object.fromEntries(
  Object.entries(NAME_TO_LEGACY_KEY).map(([name, key]) => [key, name]),
)

export default function AgendaEditor() {
  return (
    <RequireStaff>
      <EditorContent />
    </RequireStaff>
  )
}

function EditorContent() {
  const { id } = useParams()
  const { settings } = useSiteSettings()
  const { profile, hasPermission } = useAuth()
  const [meeting, setMeeting] = useState(null)
  const [items, setItems] = useState([])
  const [sectionTypes, setSectionTypes] = useState([]) // ordered array
  const [attendance, setAttendance] = useState([])
  const [attachments, setAttachments] = useState({}) // item_id -> attachment[]
  const [roles, setRoles] = useState([]) // for the attachment visibility selector
  const [loading, setLoading] = useState(true)
  const [publicView, setPublicView] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Only members with `edit_agendas` may add / edit / remove attachments.
  const canManageAttachments = hasPermission('edit_agendas')
  const isAdmin = profile?.role?.is_admin === true
  const myOrder = profile?.role?.order ?? 0

  // Visibility tiers an editor may assign: their own tier and below (admins may
  // assign any). Mirrors the Archives upload rule.
  const roleOptions = useMemo(() => {
    const filtered = roles.filter((r) => isAdmin || r.order <= myOrder)
    return filtered.length ? filtered : roles
  }, [roles, isAdmin, myOrder])

  // order -> tier name, for labelling an attachment's minimum viewing tier.
  const roleNameByOrder = useMemo(() => {
    const m = {}
    for (const r of roles) m[r.order] = r.name
    return m
  }, [roles])

  const loadSectionTypes = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_section_types')
      .select('id, name, default_order')
      .order('default_order', { ascending: true })
    setSectionTypes(data ?? [])
  }, [])

  const loadMeeting = useCallback(async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setMeeting(data)
  }, [id])

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('agenda_items')
      .select('*')
      .eq('meeting_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    setItems(data ?? [])
    setLoading(false)
  }, [id])

  // Attachments for every item in this meeting, grouped by item_id. The archive
  // join intentionally selects only non-sensitive columns (never the raw
  // file_url) — archive files open through the signing Edge Function.
  const loadAttachments = useCallback(async () => {
    const { data: its } = await supabase
      .from('agenda_items')
      .select('id')
      .eq('meeting_id', id)
    const ids = (its ?? []).map((i) => i.id)
    if (!ids.length) {
      setAttachments({})
      return
    }
    const { data } = await supabase
      .from('agenda_item_attachments')
      .select(
        'id, item_id, kind, archive_item_id, link_url, file_url, label, visibility_min_role_order, position, archive:archive_items(id, title, has_file, drive_link)',
      )
      .in('item_id', ids)
      .order('position', { ascending: true })
    const map = {}
    for (const a of data ?? []) (map[a.item_id] ??= []).push(a)
    setAttachments(map)
  }, [id])

  const loadRoles = useCallback(async () => {
    const { data } = await supabase
      .from('roles')
      .select('name, order')
      .order('order', { ascending: true })
    setRoles(data ?? [])
  }, [])

  // Attendance for the meeting's session — used to append an attendance roster
  // page to the exported agenda PDF.
  const loadAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('status, checked_in_at, profiles(full_name, student_id)')
      .eq('meeting_id', id)
      .order('checked_in_at', { ascending: true })
    setAttendance(data ?? [])
  }, [id])

  useEffect(() => {
    loadMeeting()
    loadItems()
    loadSectionTypes()
    loadAttendance()
    loadAttachments()
    loadRoles()
  }, [
    loadMeeting,
    loadItems,
    loadSectionTypes,
    loadAttendance,
    loadAttachments,
    loadRoles,
  ])

  // name -> type, for resolving legacy items lacking a section_type_id.
  const typeByName = useMemo(() => {
    const m = {}
    for (const t of sectionTypes) m[t.name] = t
    return m
  }, [sectionTypes])

  // Resolve which section type an item belongs to: prefer the FK, fall back to
  // mapping the legacy `section` string through to a type by name.
  const resolveTypeId = useCallback(
    (item) => {
      if (item.section_type_id) return item.section_type_id
      const name = LEGACY_KEY_TO_NAME[item.section]
      return name ? typeByName[name]?.id ?? null : null
    },
    [typeByName],
  )

  // Group top-level items by their resolved section type id.
  const bySectionTypeId = useMemo(() => {
    const map = {}
    for (const it of items) {
      if (it.parent_id) continue
      const tid = resolveTypeId(it)
      if (!tid) continue
      ;(map[tid] ??= []).push(it)
    }
    return map
  }, [items, resolveTypeId])

  const childrenOf = useCallback(
    (parentId) => items.filter((it) => it.parent_id === parentId),
    [items],
  )

  async function addItem(sectionType, content, parentId = null) {
    const text = content.trim()
    if (!text || !sectionType) return
    const siblings = parentId
      ? childrenOf(parentId)
      : (bySectionTypeId[sectionType.id] ?? [])
    const position = siblings.length
    await supabase.from('agenda_items').insert({
      meeting_id: id,
      section: legacyKeyFor(sectionType.name),
      section_type_id: sectionType.id,
      parent_id: parentId,
      content: text,
      position,
    })
    loadItems()
  }

  async function updateItem(itemId, patch) {
    await supabase.from('agenda_items').update(patch).eq('id', itemId)
    loadItems()
  }

  async function deleteItem(itemId) {
    await supabase.from('agenda_items').delete().eq('id', itemId)
    loadItems()
    loadAttachments()
  }

  // Insert one attachment row (kind + its single source field already set by the
  // caller). File uploads happen in the UI before this is called.
  async function addAttachment(itemId, payload) {
    const list = attachments[itemId] ?? []
    await supabase.from('agenda_item_attachments').insert({
      item_id: itemId,
      position: list.length,
      visibility_min_role_order: 0, // visible to all by default; restrict per chip
      created_by: profile?.id ?? null,
      ...payload,
    })
    loadAttachments()
  }

  // Raise/lower the minimum tier that can see an attachment.
  async function updateAttachmentVisibility(att, order) {
    await supabase
      .from('agenda_item_attachments')
      .update({ visibility_min_role_order: order })
      .eq('id', att.id)
    loadAttachments()
  }

  async function deleteAttachment(att) {
    // Remove the backing object first for uploaded files (best-effort), then the
    // row. Archive references and links own no storage object.
    if (att.kind === 'file' && att.file_url) {
      await supabase.storage.from('agenda-files').remove([att.file_url])
    }
    await supabase.from('agenda_item_attachments').delete().eq('id', att.id)
    loadAttachments()
  }

  // Persist a new top-level ordering for a section: write each item's index as
  // its `position`, then reload.
  async function reorderItems(orderedIds) {
    await Promise.all(
      orderedIds.map((itemId, i) =>
        supabase.from('agenda_items').update({ position: i }).eq('id', itemId),
      ),
    )
    loadItems()
  }

  // Build the PDF directly from agenda data with jsPDF's text API. We avoid
  // html2canvas (DOM rasterization) because it cannot parse Tailwind v4's
  // oklch() color values and throws — which previously made the button appear
  // to do nothing. Drawing text directly also yields a smaller PDF with
  // selectable text and no off-screen DOM.
  async function exportPdf() {
    setExporting(true)
    try {
      // Load jsPDF on demand so it stays out of the initial app bundle.
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 15
      const contentW = pageW - margin * 2
      let y = margin

      const MAROON = [142, 35, 28]
      const DARK = [17, 24, 39]
      const SLATE = [55, 65, 81]
      const GRAY = [107, 114, 128]
      const FAINT = [156, 163, 175]

      const ensureSpace = (h) => {
        if (y + h > pageH - margin) {
          pdf.addPage()
          y = margin
        }
      }

      // Write (optionally wrapped) text, advancing y. Returns nothing.
      const writeText = (
        text,
        { size = 11, style = 'normal', color = DARK, indent = 0, gap = 1.2 } = {},
      ) => {
        pdf.setFont('helvetica', style)
        pdf.setFontSize(size)
        pdf.setTextColor(color[0], color[1], color[2])
        const lh = size * 0.3528 * 1.25
        const lines = pdf.splitTextToSize(String(text ?? ''), contentW - indent)
        for (const line of lines) {
          ensureSpace(lh)
          pdf.text(line, margin + indent, y)
          y += lh
        }
        y += gap
      }

      const pageHeader = (title, subtitle) => {
        if (settings?.school_name) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.setTextColor(MAROON[0], MAROON[1], MAROON[2])
          pdf.text(settings.school_name.toUpperCase(), margin, y)
          y += 5
        }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(18)
        pdf.setTextColor(DARK[0], DARK[1], DARK[2])
        pdf.text(title, margin, y)
        y += 7
        if (subtitle) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(11)
          pdf.setTextColor(GRAY[0], GRAY[1], GRAY[2])
          pdf.text(subtitle, margin, y)
          y += 5
        }
        pdf.setDrawColor(MAROON[0], MAROON[1], MAROON[2])
        pdf.setLineWidth(0.7)
        pdf.line(margin, y, pageW - margin, y)
        y += 8
      }

      const sectionTitle = (name) => {
        ensureSpace(12)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(MAROON[0], MAROON[1], MAROON[2])
        pdf.text(name, margin, y)
        y += 2
        pdf.setDrawColor(229, 231, 235)
        pdf.setLineWidth(0.3)
        pdf.line(margin, y, pageW - margin, y)
        y += 6
      }

      // ---- Agenda page ----
      pageHeader('Meeting Agenda', `${meeting.title} — ${formatDate(meeting.date)}`)

      const openingType = typeByName['Opening']
      const adjournmentType = typeByName['Adjournment']
      const middleTypes = sectionTypes.filter(
        (t) => t.name !== 'Opening' && t.name !== 'Adjournment',
      )
      const orderedTypes = [
        ...(openingType ? [openingType] : []),
        ...middleTypes,
        ...(adjournmentType ? [adjournmentType] : []),
      ]

      for (const t of orderedTypes) {
        const items = bySectionTypeId[t.id] ?? []
        const isOpening = openingType && t.id === openingType.id
        const isAdjournment = adjournmentType && t.id === adjournmentType.id
        sectionTitle(t.name)

        if (isOpening) {
          writeText(`Presiding officer: ${meeting.presiding_officer || '—'}`, {
            size: 10,
            color: SLATE,
            gap: 0.5,
          })
          writeText(
            `Called to order: ${
              meeting.called_to_order
                ? new Date(meeting.called_to_order).toLocaleString()
                : '—'
            }`,
            { size: 10, color: SLATE, gap: 0.5 },
          )
          writeText(`Quorum confirmed: ${meeting.quorum_confirmed ? 'Yes' : 'No'}`, {
            size: 10,
            color: SLATE,
            gap: 0.5,
          })
          writeText(`Agenda approved: ${meeting.agenda_approved ? 'Yes' : 'No'}`, {
            size: 10,
            color: SLATE,
          })
        }

        if (items.length === 0 && !isOpening && !isAdjournment) {
          writeText('No items.', { size: 10, color: FAINT })
        } else {
          items.forEach((item, idx) => {
            const status =
              item.status && item.status !== 'No status' ? `  [${item.status}]` : ''
            writeText(`${idx + 1}. ${item.content ?? ''}${status}`, {
              size: 11,
              style: 'bold',
              gap: 0.5,
            })
            for (const sub of childrenOf(item.id)) {
              writeText(`• ${sub.content ?? ''}`, {
                size: 10,
                color: SLATE,
                indent: 6,
                gap: 0.3,
              })
            }
            if (item.secretary_notes) {
              writeText(item.secretary_notes, {
                size: 9,
                style: 'italic',
                color: GRAY,
                indent: 6,
              })
            }
            for (const att of attachments[item.id] ?? []) {
              const url =
                att.kind === 'link'
                  ? att.link_url
                  : att.kind === 'archive'
                    ? att.archive?.drive_link ?? ''
                    : ''
              writeText(`📎 ${attachmentLabel(att)}${url ? ` — ${url}` : ''}`, {
                size: 9,
                color: GRAY,
                indent: 6,
                gap: 0.3,
              })
            }
          })
        }

        if (isAdjournment) {
          writeText(
            `Next meeting: ${
              meeting.next_meeting_date ? formatDate(meeting.next_meeting_date) : '—'
            }`,
            { size: 10, color: SLATE, gap: 0.5 },
          )
          writeText(
            `Adjourned at: ${
              meeting.adjourned_at
                ? new Date(meeting.adjourned_at).toLocaleString()
                : '—'
            }`,
            { size: 10, color: SLATE },
          )
        }
        y += 4
      }

      // ---- Attendance page ----
      pdf.addPage()
      y = margin
      pageHeader('Attendance', `${meeting.title} — ${formatDate(meeting.date)}`)

      if (attendance.length === 0) {
        writeText('No attendance recorded for this meeting.', {
          size: 10,
          color: FAINT,
        })
      } else {
        const cols = [margin, margin + 90, margin + 130]
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(MAROON[0], MAROON[1], MAROON[2])
        pdf.text('Member', cols[0], y)
        pdf.text('Status', cols[1], y)
        pdf.text('Checked in', cols[2], y)
        y += 2
        pdf.setDrawColor(MAROON[0], MAROON[1], MAROON[2])
        pdf.setLineWidth(0.5)
        pdf.line(margin, y, pageW - margin, y)
        y += 5

        for (const a of attendance) {
          ensureSpace(7)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(10)
          pdf.setTextColor(SLATE[0], SLATE[1], SLATE[2])
          pdf.text(String(a.profiles?.full_name ?? 'Member'), cols[0], y)
          pdf.text(
            String(a.status ?? '').replace(/^\w/, (c) => c.toUpperCase()),
            cols[1],
            y,
          )
          pdf.text(a.checked_in_at ? formatTime(a.checked_in_at) : '—', cols[2], y)
          y += 4
          pdf.setDrawColor(229, 231, 235)
          pdf.setLineWidth(0.2)
          pdf.line(margin, y, pageW - margin, y)
          y += 4
        }
      }
      writeText(`Total recorded: ${attendance.length}`, {
        size: 9,
        color: GRAY,
      })

      const safe = (meeting.title || 'agenda').replace(/[^\w-]+/g, '-')
      pdf.save(`${safe}-agenda.pdf`)
    } catch (err) {
      console.error('Agenda PDF export failed:', err)
      alert('Sorry — the PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-maroon" />
        </div>
      </Shell>
    )
  }

  if (!meeting) {
    return (
      <Shell>
        <p className="py-20 text-center text-gray-500">Meeting not found.</p>
      </Shell>
    )
  }

  const ctx = {
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    childrenOf,
    publicView,
    meetingId: id,
    attachments,
    addAttachment,
    deleteAttachment,
    updateAttachmentVisibility,
    canManageAttachments,
    roleOptions,
    roleNameByOrder,
  }

  const openingType = typeByName['Opening']
  const adjournmentType = typeByName['Adjournment']
  // Every configured section type except Opening / Adjournment renders as a
  // generic section, in default_order. New custom types added in Admin Settings
  // appear here automatically.
  const middleTypes = sectionTypes.filter(
    (t) => t.name !== 'Opening' && t.name !== 'Adjournment',
  )

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <Link
            to={`/dashboard/meetings/${id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
          >
            <ChevronLeft className="h-4 w-4" /> Meeting
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-maroon">
            Agenda Editor
          </h1>
          <p className="text-sm text-gray-500">
            {meeting.title} — {formatDate(meeting.date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPublicView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-maroon transition hover:bg-gray-50"
          >
            {publicView ? (
              <>
                <Pencil className="h-4 w-4" /> Edit view
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Public view
              </>
            )}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-maroon transition hover:bg-gray-50 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {openingType && (
          <OpeningPanel
            meeting={meeting}
            sectionType={openingType}
            items={bySectionTypeId[openingType.id] ?? []}
            onMeetingSaved={loadMeeting}
            ctx={ctx}
          />
        )}

        {middleTypes.map((t) => (
          <AgendaSection
            key={t.id}
            sectionType={t}
            title={t.name}
            items={bySectionTypeId[t.id] ?? []}
            ctx={ctx}
          />
        ))}

        {adjournmentType && (
          <AdjournmentPanel
            meeting={meeting}
            sectionType={adjournmentType}
            items={bySectionTypeId[adjournmentType.id] ?? []}
            onMeetingSaved={loadMeeting}
            ctx={ctx}
          />
        )}
      </div>
    </Shell>
  )
}

/* ----------------------------- Opening ------------------------------------ */
function OpeningPanel({ meeting, sectionType, items, onMeetingSaved, ctx }) {
  const [presiding, setPresiding] = useState(meeting.presiding_officer ?? '')
  const [calledAt, setCalledAt] = useState(toLocalInput(meeting.called_to_order))
  const [quorum, setQuorum] = useState(meeting.quorum_confirmed)
  const [approved, setApproved] = useState(meeting.agenda_approved)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase
      .from('meetings')
      .update({
        presiding_officer: presiding.trim() || null,
        called_to_order: fromLocalInput(calledAt),
        quorum_confirmed: quorum,
        agenda_approved: approved,
      })
      .eq('id', meeting.id)
    setSaving(false)
    onMeetingSaved()
  }

  async function syncTimes() {
    const { data } = await supabase
      .from('attendance')
      .select('checked_in_at')
      .eq('meeting_id', meeting.id)
      .order('checked_in_at', { ascending: true })
      .limit(1)
    const first = data?.[0]?.checked_in_at ?? new Date().toISOString()
    setCalledAt(toLocalInput(first))
  }

  return (
    <SectionCard title={sectionType.name}>
      {!ctx.publicView && (
        <div className="rounded-xl bg-blue-50/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Presiding officer
              </span>
              <input
                value={presiding}
                onChange={(e) => setPresiding(e.target.value)}
                className={inputClass}
                placeholder="Name"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Called to order
              </span>
              <input
                type="datetime-local"
                value={calledAt}
                onChange={(e) => setCalledAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <Checkbox label="Quorum confirmed" checked={quorum} onChange={setQuorum} />
            <Checkbox
              label="Agenda approved"
              checked={approved}
              onChange={setApproved}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={syncTimes}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Sync times from QR session
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-1.5 text-sm font-semibold text-white hover:bg-maroon-dark disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      )}

      {ctx.publicView && (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Detail label="Presiding officer" value={meeting.presiding_officer || '—'} />
          <Detail
            label="Called to order"
            value={
              meeting.called_to_order
                ? new Date(meeting.called_to_order).toLocaleString()
                : '—'
            }
          />
          <Detail
            label="Quorum confirmed"
            value={meeting.quorum_confirmed ? 'Yes' : 'No'}
          />
          <Detail
            label="Agenda approved"
            value={meeting.agenda_approved ? 'Yes' : 'No'}
          />
        </dl>
      )}

      <ItemList sectionType={sectionType} items={items} ctx={ctx} />
    </SectionCard>
  )
}

/* --------------------------- Adjournment ---------------------------------- */
function AdjournmentPanel({ meeting, sectionType, items, onMeetingSaved, ctx }) {
  const [nextDate, setNextDate] = useState(meeting.next_meeting_date ?? '')
  const [adjournedAt, setAdjournedAt] = useState(
    toLocalInput(meeting.adjourned_at),
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase
      .from('meetings')
      .update({
        next_meeting_date: nextDate || null,
        adjourned_at: fromLocalInput(adjournedAt),
      })
      .eq('id', meeting.id)
    setSaving(false)
    onMeetingSaved()
  }

  return (
    <SectionCard title={sectionType.name}>
      {!ctx.publicView && (
        <div className="rounded-xl bg-blue-50/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Next meeting date
              </span>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-600">
                Adjourned at
              </span>
              <input
                type="datetime-local"
                value={adjournedAt}
                onChange={(e) => setAdjournedAt(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-1.5 text-sm font-semibold text-white hover:bg-maroon-dark disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
      <ItemList sectionType={sectionType} items={items} ctx={ctx} />
    </SectionCard>
  )
}

/* ------------------------- Generic section -------------------------------- */
function AgendaSection({ sectionType, title, items, ctx }) {
  return (
    <SectionCard title={title}>
      <ItemList sectionType={sectionType} items={items} ctx={ctx} />
    </SectionCard>
  )
}

function ItemList({ sectionType, items, ctx }) {
  // Local copy so a drag reorders instantly; it re-syncs whenever the canonical
  // items change (after add / delete / reload).
  const [ordered, setOrdered] = useState(items)
  const [dragId, setDragId] = useState(null)

  useEffect(() => {
    setOrdered(items)
  }, [items])

  function handleDrop(targetId) {
    const current = dragId
    setDragId(null)
    if (!current || current === targetId) return
    const ids = ordered.map((i) => i.id)
    const from = ids.indexOf(current)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    const next = [...ordered]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setOrdered(next)
    ctx.reorderItems(next.map((i) => i.id))
  }

  return (
    <div className={ordered.length ? 'divide-y divide-gray-100' : ''}>
      {ordered.map((item) => (
        <AgendaItem
          key={item.id}
          item={item}
          sectionType={sectionType}
          ctx={ctx}
          isDragging={dragId === item.id}
          onDragStart={() => setDragId(item.id)}
          onDrop={() => handleDrop(item.id)}
        />
      ))}
      {!ctx.publicView && (
        <AddItemInput
          placeholder={`Add item to ${sectionType.name}…`}
          onAdd={(text) => ctx.addItem(sectionType, text)}
        />
      )}
      {ctx.publicView && ordered.length === 0 && (
        <p className="py-2 text-sm text-gray-400">No items.</p>
      )}
    </div>
  )
}

function AgendaItem({ item, sectionType, ctx, isDragging, onDragStart, onDrop }) {
  const subItems = ctx.childrenOf(item.id)
  // The row is only draggable while the grip handle is held, so the text
  // inputs stay normally editable / selectable the rest of the time.
  const [draggable, setDraggable] = useState(false)

  if (ctx.publicView) {
    return (
      <div className="py-2">
        <p className="font-medium text-maroon">{item.content}</p>
        {item.status && item.status !== 'No status' && (
          <span className="text-xs text-gray-500">Status: {item.status}</span>
        )}
        {subItems.length > 0 && (
          <ul className="ml-5 mt-1 list-disc text-sm text-gray-600">
            {subItems.map((s) => (
              <li key={s.id}>{s.content}</li>
            ))}
          </ul>
        )}
        {item.secretary_notes && (
          <p className="mt-1 text-sm italic text-gray-500">
            {item.secretary_notes}
          </p>
        )}
        <AttachmentArea item={item} ctx={ctx} />
      </div>
    )
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={() => setDraggable(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setDraggable(false)
        onDrop?.()
      }}
      className={`py-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          onMouseDown={() => setDraggable(true)}
          onMouseUp={() => setDraggable(false)}
          className="mt-1 h-4 w-4 shrink-0 cursor-grab text-gray-300 hover:text-gray-500"
        />
        <div className="min-w-0 flex-1">
          <input
            defaultValue={item.content}
            onBlur={(e) => {
              if (e.target.value !== item.content)
                ctx.updateItem(item.id, { content: e.target.value })
            }}
            className="w-full border-0 bg-transparent p-0 font-medium text-maroon outline-none focus:ring-0"
          />

          {/* sub-items */}
          {subItems.length > 0 && (
            <div className="ml-1 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
              {subItems.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    defaultValue={s.content}
                    onBlur={(e) => {
                      if (e.target.value !== s.content)
                        ctx.updateItem(s.id, { content: e.target.value })
                    }}
                    className="w-full border-0 bg-transparent p-0 text-sm text-maroon outline-none focus:ring-0"
                  />
                  <button
                    onClick={() => ctx.deleteItem(s.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <AddItemInput
            small
            placeholder="Add sub-item…"
            onAdd={(text) => ctx.addItem(sectionType, text, item.id)}
          />

          <input
            defaultValue={item.secretary_notes ?? ''}
            onBlur={(e) => {
              if ((e.target.value || null) !== (item.secretary_notes ?? null))
                ctx.updateItem(item.id, {
                  secretary_notes: e.target.value || null,
                })
            }}
            placeholder="Secretary notes…"
            className="mt-1 w-full border-b border-dashed border-gray-200 bg-transparent p-0 text-xs italic text-gray-500 outline-none focus:border-maroon/40"
          />

          <AttachmentArea item={item} ctx={ctx} />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <select
            value={item.status ?? 'No status'}
            onChange={(e) =>
              ctx.updateItem(item.id, {
                status: e.target.value === 'No status' ? null : e.target.value,
              })
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-maroon outline-none focus:border-maroon"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button
            onClick={() => ctx.deleteItem(item.id)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Attachments ---------------------------------- */
function attachmentLabel(att) {
  if (att.kind === 'archive')
    return att.archive?.title || att.label || 'Archived item'
  return att.label || att.link_url || 'Attachment'
}

function AttachmentIcon({ kind, className }) {
  if (kind === 'archive') return <Archive className={className} />
  if (kind === 'link') return <Link2 className={className} />
  return <FileText className={className} />
}

// Attachments strip rendered under each agenda item. Adding, removing, and
// changing per-attachment visibility require `edit_agendas` (ctx.canManageAttachments);
// everyone else who can see the agenda gets read-only chips for the attachments
// their tier permits (the row list itself is already RLS-filtered).
function AttachmentArea({ item, ctx }) {
  const list = ctx.attachments?.[item.id] ?? []
  const canManage = !ctx.publicView && ctx.canManageAttachments
  if (!list.length && !canManage) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {list.map((att) => (
        <AttachmentChip key={att.id} att={att} ctx={ctx} canManage={canManage} />
      ))}
      {canManage && <AddAttachment item={item} ctx={ctx} />}
    </div>
  )
}

function AttachmentChip({ att, ctx, canManage }) {
  const [opening, setOpening] = useState(false)

  // Open via a synchronously-opened tab so the eventual signed-URL navigation
  // isn't treated as a popup.
  async function openViaFunction(fn, body) {
    setOpening(true)
    const tab = window.open('', '_blank')
    const { data, error } = await supabase.functions.invoke(fn, { body })
    setOpening(false)
    if (error || !data?.url) {
      if (tab) tab.close()
      alert('Could not open this file.')
      return
    }
    if (tab) tab.location = data.url
    else window.open(data.url, '_blank')
  }

  async function open() {
    if (att.kind === 'link') {
      window.open(att.link_url, '_blank', 'noopener')
      return
    }
    if (att.kind === 'file') {
      await openViaFunction('agenda-file-url', { attachment_id: att.id })
      return
    }
    // archive: stored files go through the archive signing Edge Function
    // (preserving the archive's own tier-gating); link-based items open directly.
    if (att.archive?.has_file) {
      await openViaFunction('archive-file-url', { item_id: att.archive_item_id })
    } else if (att.archive?.drive_link) {
      window.open(att.archive.drive_link, '_blank', 'noopener')
    } else {
      alert('This archived item is no longer available to you.')
    }
  }

  const restricted = att.visibility_min_role_order > 0
  const tierName = ctx.roleNameByOrder?.[att.visibility_min_role_order]

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1.5 text-xs text-maroon">
      <button
        type="button"
        onClick={open}
        disabled={opening}
        className="inline-flex max-w-[16rem] items-center gap-1.5 hover:underline disabled:opacity-60"
      >
        {opening ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <AttachmentIcon kind={att.kind} className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{attachmentLabel(att)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />
      </button>

      {canManage ? (
        <span
          className="inline-flex items-center gap-0.5 border-l border-gray-200 pl-1.5 text-gray-400"
          title="Minimum tier that can view this attachment"
        >
          <Lock className="h-3 w-3 shrink-0" />
          <select
            value={att.visibility_min_role_order}
            onChange={(e) =>
              ctx.updateAttachmentVisibility(att, Number(e.target.value))
            }
            className="max-w-[7rem] cursor-pointer truncate border-0 bg-transparent py-0 pl-0.5 pr-1 text-xs text-gray-500 outline-none focus:ring-0"
          >
            {ctx.roleOptions.map((r) => (
              <option key={r.order} value={r.order}>
                {r.name}
              </option>
            ))}
          </select>
        </span>
      ) : (
        restricted && (
          <span
            className="inline-flex items-center text-gray-400"
            title={tierName ? `Visible to ${tierName} and up` : 'Restricted'}
          >
            <Lock className="h-3 w-3 shrink-0" />
          </span>
        )
      )}

      {canManage && (
        <button
          type="button"
          onClick={() => ctx.deleteAttachment(att)}
          aria-label="Remove attachment"
          className="grid h-4 w-4 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function AttachMenuButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-maroon hover:bg-gray-50"
    >
      <Icon className="h-3.5 w-3.5 text-gray-400" /> {label}
    </button>
  )
}

function AddAttachment({ item, ctx }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(null) // 'link' | 'file' | 'archive'
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setMode(null)
    setOpen(false)
    setLinkUrl('')
    setLinkLabel('')
    setError('')
  }

  async function addLink(e) {
    e.preventDefault()
    const url = linkUrl.trim()
    if (!url) return
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    await ctx.addAttachment(item.id, {
      kind: 'link',
      link_url: normalized,
      label: linkLabel.trim() || normalized,
    })
    reset()
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${ctx.meetingId}/${item.id}/${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage
      .from('agenda-files')
      .upload(path, file, { upsert: false })
    if (upErr) {
      setUploading(false)
      setError('Upload failed. Please try again.')
      return
    }
    await ctx.addAttachment(item.id, {
      kind: 'file',
      file_url: path,
      label: file.name,
    })
    setUploading(false)
    reset()
  }

  async function pickArchive(archiveItem) {
    await ctx.addAttachment(item.id, {
      kind: 'archive',
      archive_item_id: archiveItem.id,
      label: archiveItem.title,
    })
    reset()
  }

  if (mode === 'archive') {
    return <ArchivePicker onPick={pickArchive} onClose={reset} />
  }

  if (mode === 'link') {
    return (
      <form onSubmit={addLink} className="flex w-full flex-wrap items-center gap-2">
        <input
          autoFocus
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-maroon outline-none focus:border-maroon/40"
        />
        <input
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Label (optional)"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-maroon outline-none focus:border-maroon/40"
        />
        <button
          type="submit"
          className="rounded-lg bg-maroon px-2.5 py-1 text-xs font-semibold text-white hover:bg-maroon-dark"
        >
          Add
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </form>
    )
  }

  if (mode === 'file') {
    return (
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-maroon hover:bg-gray-50">
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? 'Uploading…' : 'Choose file'}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={uploadFile}
          />
        </label>
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:border-maroon/40 hover:text-maroon"
      >
        <Paperclip className="h-3 w-3" /> Attach
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <AttachMenuButton
            icon={Archive}
            label="From Archives"
            onClick={() => {
              setOpen(false)
              setMode('archive')
            }}
          />
          <AttachMenuButton
            icon={Link2}
            label="Paste a link"
            onClick={() => {
              setOpen(false)
              setMode('link')
            }}
          />
          <AttachMenuButton
            icon={Upload}
            label="Upload a file"
            onClick={() => {
              setOpen(false)
              setMode('file')
            }}
          />
        </div>
      )}
    </div>
  )
}

// Modal that lists archive items the viewer is permitted to see (RLS-scoped) so
// an existing report/document can be referenced from an agenda item.
function ArchivePicker({ onPick, onClose }) {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase
      .from('archive_items')
      .select('id, title, category, folder_path, has_file, drive_link')
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
  }, [])

  const filtered = (items ?? []).filter((it) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return `${it.title} ${it.category ?? ''} ${it.folder_path ?? ''}`
      .toLowerCase()
      .includes(s)
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-display font-bold text-maroon">
            Attach from Archives
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search archives…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {items === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-maroon" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No archive items found.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => onPick(it)}
                    className="flex w-full items-center gap-2 px-1 py-2 text-left hover:bg-gray-50"
                  >
                    {it.has_file ? (
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    ) : (
                      <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-maroon">
                        {it.title}
                      </span>
                      {(it.category || it.folder_path) && (
                        <span className="block truncate text-xs text-gray-400">
                          {[it.category, it.folder_path]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function AddItemInput({ placeholder, onAdd, small }) {
  const [value, setValue] = useState('')
  function submit(e) {
    e.preventDefault()
    if (!value.trim()) return
    onAdd(value)
    setValue('')
  }
  return (
    <form onSubmit={submit} className="mt-1 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 rounded-lg border border-gray-200 bg-white px-3 ${
          small ? 'py-1 text-sm' : 'py-2'
        } text-maroon outline-none placeholder:text-gray-400 focus:border-maroon/40 focus:ring-2 focus:ring-maroon/10`}
      />
      <button
        type="submit"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-maroon transition hover:bg-maroon/5"
        aria-label="Add"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  )
}

/* ------------------------------- bits ------------------------------------- */
function SectionCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/70 px-5 py-3">
        <h2 className="font-semibold text-maroon">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-maroon">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon"
      />
      {label}
    </label>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </dt>
      <dd className="text-maroon">{value}</dd>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 print:bg-white">
      <div className="print:hidden">
        <Navbar />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </div>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}

function toLocalInput(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
