import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import supabase from '../../lib/supabaseClient.js'
import { Card, Labeled, Loading, Toggle, inputClass } from '../ui.jsx'

// Elected positions, formerly Admin Panel → "Elected Positions". Now the SGA
// Elections page's Positions tab, since these rows are what candidates run for.
const POSITION_GROUPS = [
  'exec',
  'senior',
  'junior',
  'sophomore',
  'freshman',
  'custom',
]

// A position's description (markdown) + requirements checklist were folded in
// from the retired application `positions` table, so this is now the single
// place positions are authored. Requirements are a text[] edited one-per-line.
const reqToText = (req) => (req ?? []).join('\n')
const textToReq = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export default function PositionsTab() {
  const [positions, setPositions] = useState([])
  const [counts, setCounts] = useState({})
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', group: 'exec', order: 1 })

  const load = useCallback(async () => {
    const [{ data: pos }, { data: profiles }, { data: roleRows }] = await Promise.all([
      supabase
        .from('elected_positions')
        .select('*')
        .order('group', { ascending: true })
        .order('order', { ascending: true }),
      supabase.from('profiles').select('elected_position_id'),
      supabase.from('roles').select('id, name, "order", is_admin').order('order', { ascending: true }),
    ])
    const c = {}
    for (const p of profiles ?? []) {
      if (p.elected_position_id)
        c[p.elected_position_id] = (c[p.elected_position_id] ?? 0) + 1
    }
    setCounts(c)
    setPositions(pos ?? [])
    setRoles(roleRows ?? [])
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
                roles={roles}
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

function PositionRow({ position, roles = [], memberCount, onChanged }) {
  const [title, setTitle] = useState(position.title)
  const [group, setGroup] = useState(position.group)
  const [order, setOrder] = useState(position.order)
  const [grantRoleId, setGrantRoleId] = useState(position.default_role_id ?? '')
  const [description, setDescription] = useState(position.description ?? '')
  const [reqText, setReqText] = useState(reqToText(position.requirements))
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setTitle(position.title)
    setGroup(position.group)
    setOrder(position.order)
    setGrantRoleId(position.default_role_id ?? '')
    setDescription(position.description ?? '')
    setReqText(reqToText(position.requirements))
  }, [position])

  const dirty =
    title.trim() !== position.title ||
    group !== position.group ||
    Number(order) !== position.order ||
    (grantRoleId || null) !== (position.default_role_id ?? null) ||
    (description.trim() || '') !== (position.description ?? '') ||
    reqText !== reqToText(position.requirements)

  const detailCount =
    (position.description ? 1 : 0) + (position.requirements?.length ?? 0)

  async function save() {
    if (!title.trim()) return
    const { error } = await supabase
      .from('elected_positions')
      .update({
        title: title.trim(),
        group,
        order: Number(order),
        default_role_id: grantRoleId || null,
        description: description.trim() || null,
        requirements: textToReq(reqText),
      })
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
    <div className="rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center gap-3 p-3">
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
        <select
          value={grantRoleId}
          onChange={(e) => setGrantRoleId(e.target.value)}
          title="Role automatically granted when a member wins this position"
          className={`${inputClass} w-44`}
        >
          <option value="">No role change</option>
          {roles
            .filter((r) => !r.is_admin)
            .map((r) => (
              <option key={r.id} value={r.id}>
                Grants: {r.name}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <Toggle checked={position.show_in_elections} onChange={toggleElections} />
          Elections
        </label>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-maroon"
          title="Description & requirements shown to applicants"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          Details{detailCount > 0 ? ` (${detailCount})` : ''}
        </button>
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

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          <Labeled label="Description (Markdown — shown on the application card)">
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the role involves, expectations, etc."
              className={`${inputClass} resize-y`}
            />
          </Labeled>
          <Labeled label="Requirements (one per line)">
            <textarea
              rows={3}
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
              placeholder={'2.5 GPA\nTeacher recommendation\nAttend the candidate meeting'}
              className={`${inputClass} resize-y`}
            />
          </Labeled>
          <p className="text-xs text-gray-400">
            These appear on the position card in the “Choose Your Position” step of a
            candidate’s application. Use the Save button above to apply changes.
          </p>
        </div>
      )}
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

