import { useCallback, useEffect, useState } from 'react'
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
import supabase from '../../lib/supabaseClient.js'
import { Card, Labeled, Loading, Toggle, inputClass } from '../ui.jsx'

// Agenda section types, formerly Admin Panel → "Agenda Sections". Now the
// Meetings page's Settings tab.

export default function SectionTypesTab() {
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

