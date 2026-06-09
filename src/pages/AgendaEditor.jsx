import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Loader2,
  FileDown,
  Eye,
  Pencil,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
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
  const [meeting, setMeeting] = useState(null)
  const [items, setItems] = useState([])
  const [sectionTypes, setSectionTypes] = useState([]) // ordered array
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [publicView, setPublicView] = useState(false)
  const [exporting, setExporting] = useState(false)
  const agendaPrintRef = useRef(null)
  const attendancePrintRef = useRef(null)

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
  }, [loadMeeting, loadItems, loadSectionTypes, loadAttendance])

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

  // Render a hidden off-screen element to a canvas, then lay it across as many
  // PDF pages as its height requires. The printable elements use plain inline
  // styles (hex colors only) so html2canvas never meets Tailwind's oklch()
  // color functions, which it cannot parse.
  async function exportPdf() {
    setExporting(true)
    try {
      // Load the heavy PDF libraries on demand so they stay out of the initial
      // app bundle — they're only needed the moment someone exports.
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      const addElement = async (el, isFirst) => {
        if (!el) return
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: '#ffffff',
        })
        const imgData = canvas.toDataURL('image/png')
        const imgW = pageW
        const imgH = (canvas.height * imgW) / canvas.width
        let heightLeft = imgH
        let position = 0
        if (!isFirst) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
        heightLeft -= pageH
        while (heightLeft > 0) {
          position -= pageH
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
          heightLeft -= pageH
        }
      }

      await addElement(agendaPrintRef.current, true)
      await addElement(attendancePrintRef.current, false)

      const safe = (meeting.title || 'agenda').replace(/[^\w-]+/g, '-')
      pdf.save(`${safe}-agenda.pdf`)
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
  }

  const openingType = typeByName['Opening']
  const adjournmentType = typeByName['Adjournment']
  // Every configured section type except Opening / Adjournment renders as a
  // generic section, in default_order. New custom types added in Admin Settings
  // appear here automatically.
  const middleTypes = sectionTypes.filter(
    (t) => t.name !== 'Opening' && t.name !== 'Adjournment',
  )

  // Section order for the printable agenda: Opening first, then everything
  // else in default_order, Adjournment last — mirroring the on-screen layout.
  const printTypes = [
    ...(openingType ? [openingType] : []),
    ...middleTypes,
    ...(adjournmentType ? [adjournmentType] : []),
  ]

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
          <h1 className="mt-1 font-display text-2xl font-bold text-gray-900">
            Agenda Editor
          </h1>
          <p className="text-sm text-gray-500">
            {meeting.title} — {formatDate(meeting.date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPublicView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
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

      {/* Off-screen clean renders captured by html2canvas for the PDF export. */}
      <PrintableAgenda
        innerRef={agendaPrintRef}
        meeting={meeting}
        schoolName={settings?.school_name}
        types={printTypes}
        openingId={openingType?.id}
        adjournmentId={adjournmentType?.id}
        bySectionTypeId={bySectionTypeId}
        childrenOf={childrenOf}
      />
      <PrintableAttendance
        innerRef={attendancePrintRef}
        meeting={meeting}
        schoolName={settings?.school_name}
        attendance={attendance}
      />
    </Shell>
  )
}

/* --------------------- Printable (PDF) renders ---------------------------- */
// Hidden, fixed-width (A4-ish at 96dpi), inline-styled views captured by
// html2canvas. Inline hex colors only — never Tailwind classes — so the
// capture doesn't choke on oklch() color functions.
const PRINT_WRAP = {
  position: 'absolute',
  left: '-10000px',
  top: 0,
  width: '760px',
  padding: '40px',
  background: '#ffffff',
  color: '#111827',
  fontFamily: 'Georgia, "Times New Roman", serif',
}

function PrintHeader({ schoolName, title, subtitle }) {
  return (
    <div style={{ borderBottom: '3px solid #8e231c', paddingBottom: '12px', marginBottom: '20px' }}>
      {schoolName && (
        <div style={{ fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', color: '#8e231c', fontWeight: 700 }}>
          {schoolName}
        </div>
      )}
      <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>{subtitle}</div>}
    </div>
  )
}

function PrintableAgenda({
  innerRef,
  meeting,
  schoolName,
  types,
  openingId,
  adjournmentId,
  bySectionTypeId,
  childrenOf,
}) {
  return (
    <div ref={innerRef} style={PRINT_WRAP}>
      <PrintHeader
        schoolName={schoolName}
        title="Meeting Agenda"
        subtitle={`${meeting.title} — ${formatDate(meeting.date)}`}
      />

      {types.map((t) => {
        const items = bySectionTypeId[t.id] ?? []
        const isOpening = t.id === openingId
        const isAdjournment = t.id === adjournmentId
        return (
          <div key={t.id} style={{ marginBottom: '22px' }}>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#8e231c',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '4px',
                marginBottom: '8px',
              }}
            >
              {t.name}
            </div>

            {isOpening && (
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                <div>Presiding officer: {meeting.presiding_officer || '—'}</div>
                <div>
                  Called to order:{' '}
                  {meeting.called_to_order
                    ? new Date(meeting.called_to_order).toLocaleString()
                    : '—'}
                </div>
                <div>Quorum confirmed: {meeting.quorum_confirmed ? 'Yes' : 'No'}</div>
                <div>Agenda approved: {meeting.agenda_approved ? 'Yes' : 'No'}</div>
              </div>
            )}

            {items.length === 0 && !isOpening && !isAdjournment ? (
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>No items.</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                {items.map((item) => {
                  const subs = childrenOf(item.id)
                  return (
                    <li key={item.id} style={{ fontSize: '14px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{item.content}</span>
                      {item.status && item.status !== 'No status' && (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          {' '}
                          [{item.status}]
                        </span>
                      )}
                      {subs.length > 0 && (
                        <ul style={{ margin: '2px 0 0', paddingLeft: '18px' }}>
                          {subs.map((s) => (
                            <li key={s.id} style={{ fontSize: '13px', color: '#374151' }}>
                              {s.content}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.secretary_notes && (
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#6b7280', marginTop: '2px' }}>
                          {item.secretary_notes}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}

            {isAdjournment && (
              <div style={{ fontSize: '13px', color: '#374151', marginTop: '8px' }}>
                <div>
                  Next meeting:{' '}
                  {meeting.next_meeting_date ? formatDate(meeting.next_meeting_date) : '—'}
                </div>
                <div>
                  Adjourned at:{' '}
                  {meeting.adjourned_at
                    ? new Date(meeting.adjourned_at).toLocaleString()
                    : '—'}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PrintableAttendance({ innerRef, meeting, schoolName, attendance }) {
  const cell = {
    padding: '6px 8px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    textAlign: 'left',
  }
  return (
    <div ref={innerRef} style={PRINT_WRAP}>
      <PrintHeader
        schoolName={schoolName}
        title="Attendance"
        subtitle={`${meeting.title} — ${formatDate(meeting.date)}`}
      />
      {attendance.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#9ca3af' }}>
          No attendance recorded for this meeting.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, fontWeight: 700, color: '#8e231c', borderBottom: '2px solid #8e231c' }}>
                Member
              </th>
              <th style={{ ...cell, fontWeight: 700, color: '#8e231c', borderBottom: '2px solid #8e231c' }}>
                Status
              </th>
              <th style={{ ...cell, fontWeight: 700, color: '#8e231c', borderBottom: '2px solid #8e231c' }}>
                Checked in
              </th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a, i) => (
              <tr key={i}>
                <td style={cell}>{a.profiles?.full_name ?? 'Member'}</td>
                <td style={{ ...cell, textTransform: 'capitalize' }}>{a.status}</td>
                <td style={cell}>{a.checked_in_at ? formatTime(a.checked_in_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '14px' }}>
        Total recorded: {attendance.length}
      </div>
    </div>
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
        <p className="font-medium text-gray-900">{item.content}</p>
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
            className="w-full border-0 bg-transparent p-0 font-medium text-gray-900 outline-none focus:ring-0"
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
                    className="w-full border-0 bg-transparent p-0 text-sm text-gray-700 outline-none focus:ring-0"
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
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <select
            value={item.status ?? 'No status'}
            onChange={(e) =>
              ctx.updateItem(item.id, {
                status: e.target.value === 'No status' ? null : e.target.value,
              })
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-maroon"
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
        } text-gray-700 outline-none placeholder:text-gray-400 focus:border-maroon/40 focus:ring-2 focus:ring-maroon/10`}
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
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
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
      <dd className="text-gray-800">{value}</dd>
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
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
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
