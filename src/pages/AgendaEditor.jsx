import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  GripVertical,
  Loader2,
  Printer,
  Eye,
  Pencil,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireStaff from '../components/RequireStaff.jsx'
import supabase from '../lib/supabaseClient.js'
import { formatDate } from '../lib/format.js'

const STATUS_OPTIONS = [
  'No status',
  'In progress',
  'Approved',
  'Tabled',
  'Failed',
  'Carried',
]

const CORE_SECTIONS = [
  { key: 'unfinished', title: 'Unfinished Business' },
  { key: 'new', title: 'New Business' },
  { key: 'open_floor', title: 'Open Floor' },
]

export default function AgendaEditor() {
  return (
    <RequireStaff>
      <EditorContent />
    </RequireStaff>
  )
}

function EditorContent() {
  const { id } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [publicView, setPublicView] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [showReports, setShowReports] = useState(false)

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
    const rows = data ?? []
    setItems(rows)
    if (rows.some((r) => r.section === 'announcements')) setShowAnnouncements(true)
    if (rows.some((r) => r.section === 'reports')) setShowReports(true)
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadMeeting()
    loadItems()
  }, [loadMeeting, loadItems])

  const bySection = useMemo(() => {
    const map = {}
    for (const it of items) {
      if (it.parent_id) continue
      ;(map[it.section] ??= []).push(it)
    }
    return map
  }, [items])

  const childrenOf = useCallback(
    (parentId) => items.filter((it) => it.parent_id === parentId),
    [items],
  )

  async function addItem(section, content, parentId = null) {
    const text = content.trim()
    if (!text) return
    const siblings = parentId
      ? childrenOf(parentId)
      : (bySection[section] ?? [])
    const position = siblings.length
    await supabase.from('agenda_items').insert({
      meeting_id: id,
      section,
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

  const ctx = { addItem, updateItem, deleteItem, childrenOf, publicView }

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
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <OpeningPanel
          meeting={meeting}
          items={bySection['opening'] ?? []}
          onMeetingSaved={loadMeeting}
          ctx={ctx}
        />

        {CORE_SECTIONS.map((s) => (
          <AgendaSection
            key={s.key}
            sectionKey={s.key}
            title={s.title}
            items={bySection[s.key] ?? []}
            ctx={ctx}
          />
        ))}

        <AdjournmentPanel
          meeting={meeting}
          items={bySection['adjournment'] ?? []}
          onMeetingSaved={loadMeeting}
          ctx={ctx}
        />

        {showAnnouncements && (
          <AgendaSection
            sectionKey="announcements"
            title="Announcements"
            items={bySection['announcements'] ?? []}
            ctx={ctx}
          />
        )}
        {showReports && (
          <AgendaSection
            sectionKey="reports"
            title="Officer and Committee Reports"
            items={bySection['reports'] ?? []}
            ctx={ctx}
          />
        )}
      </div>

      {!publicView && (
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          {!showAnnouncements && (
            <button
              onClick={() => setShowAnnouncements(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 transition hover:border-maroon/40 hover:text-maroon"
            >
              <Plus className="h-4 w-4" /> Show Announcements
            </button>
          )}
          {!showReports && (
            <button
              onClick={() => setShowReports(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 transition hover:border-maroon/40 hover:text-maroon"
            >
              <Plus className="h-4 w-4" /> Show Officer and Committee Reports
            </button>
          )}
        </div>
      )}
    </Shell>
  )
}

/* ----------------------------- Opening ------------------------------------ */
function OpeningPanel({ meeting, items, onMeetingSaved, ctx }) {
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
    <SectionCard title="Opening">
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

      <ItemList sectionKey="opening" items={items} ctx={ctx} />
    </SectionCard>
  )
}

/* --------------------------- Adjournment ---------------------------------- */
function AdjournmentPanel({ meeting, items, onMeetingSaved, ctx }) {
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
    <SectionCard title="Adjournment">
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
      <ItemList sectionKey="adjournment" items={items} ctx={ctx} />
    </SectionCard>
  )
}

/* ------------------------- Generic section -------------------------------- */
function AgendaSection({ sectionKey, title, items, ctx }) {
  return (
    <SectionCard title={title}>
      <ItemList sectionKey={sectionKey} items={items} ctx={ctx} />
    </SectionCard>
  )
}

function ItemList({ sectionKey, items, ctx }) {
  return (
    <div className={items.length ? 'divide-y divide-gray-100' : ''}>
      {items.map((item) => (
        <AgendaItem key={item.id} item={item} ctx={ctx} />
      ))}
      {!ctx.publicView && (
        <AddItemInput
          placeholder={`Add item to ${sectionLabel(sectionKey)}…`}
          onAdd={(text) => ctx.addItem(sectionKey, text)}
        />
      )}
      {ctx.publicView && items.length === 0 && (
        <p className="py-2 text-sm text-gray-400">No items.</p>
      )}
    </div>
  )
}

function AgendaItem({ item, ctx }) {
  const subItems = ctx.childrenOf(item.id)

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
    <div className="py-3">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-gray-300" />
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
            onAdd={(text) => ctx.addItem(item.section, text, item.id)}
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

function sectionLabel(key) {
  return (
    {
      opening: 'Opening',
      unfinished: 'Unfinished Business',
      new: 'New Business',
      open_floor: 'Open Floor',
      adjournment: 'Adjournment',
      announcements: 'Announcements',
      reports: 'Reports',
    }[key] ?? key
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
