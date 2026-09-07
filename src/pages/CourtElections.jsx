import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import RequirePermission from '../components/RequirePermission.jsx'
import supabase from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import { Card, Labeled, Loading, Toggle, inputClass } from '../components/ui.jsx'

// Court Elections — the roster and tally behind the public /kiosk voting page.
// Promoted out of the admin panel to its own dashboard page and onto its own
// permission key (manage_court), so running the court can be delegated without
// handing over the SGA election machinery.
export default function CourtElections() {
  return (
    <RequirePermission permission="manage_court">
      <div className="flex min-h-screen flex-col bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-maroon">
                Court Elections
              </h1>
              <p className="mt-1 text-gray-500">
                Homecoming Court roster, voting window, and results.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
            >
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>

          <div className="mt-8">
            <HomecomingSection />
          </div>
        </div>
      </div>
    </RequirePermission>
  )
}

// The roster and tally behind the public /kiosk voting page. Gender isn't a
// field anyone types: there is one column per gender and adding to a column
// sets it, so the form only ever asks for a name and a grade.
const HC_GRADES = [9, 10, 11, 12]

function HomecomingSection() {
  const [candidates, setCandidates] = useState([])
  const [ballots, setBallots] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: cands }, { data: cast }] = await Promise.all([
      supabase
        .from('homecoming_candidates')
        .select('*')
        .order('grade_level', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('full_name', { ascending: true }),
      supabase
        .from('homecoming_ballots')
        .select(
          'grade_level, female_candidate_id, female_name, male_candidate_id, male_name',
        ),
    ])
    setCandidates(cands ?? [])
    setBallots(cast ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <HomecomingVotingCard />
      {/* Female left, male right — side by side from lg so the two
          rosters read as one ballot rather than a long scroll. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <HomecomingRosterCard
          gender="female"
          label="Female candidates"
          candidates={candidates}
          onChanged={load}
        />
        <HomecomingRosterCard
          gender="male"
          label="Male candidates"
          candidates={candidates}
          onChanged={load}
        />
      </div>
      <HomecomingResultsCard
        candidates={candidates}
        ballots={ballots}
        onChanged={load}
      />
    </div>
  )
}

function HomecomingVotingCard() {
  const { settings, refresh } = useSiteSettings()
  const [saving, setSaving] = useState(false)
  const open = settings?.homecoming_voting_open === true

  async function toggle(next) {
    setSaving(true)
    const { error: updateError } = await supabase
      .from('site_settings')
      .update({ homecoming_voting_open: next })
      .eq('id', 1)
    if (!updateError) await refresh()
    setSaving(false)
  }

  const kioskUrl = `${window.location.origin}/kiosk`

  return (
    <Card
      title="Voting"
      desc="The kiosk only accepts ballots while this is on. Turning it off closes voting immediately, even on a screen that's already loaded."
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-maroon">
            {open ? 'Voting is open' : 'Voting is closed'}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            Anyone with the kiosk link can vote, as many times as they like —
            keep the kiosk supervised and close voting when you're done.
          </p>
        </div>
        <Toggle checked={open} onChange={toggle} disabled={saving} />
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5">
        <p className="text-sm font-semibold text-maroon">Kiosk link</p>
        <p className="mt-0.5 text-sm text-gray-500">
          Nothing on the site links here — type it into the kiosk browser.
        </p>
        <code className="mt-2 block break-all rounded-lg bg-maroon/5 px-3.5 py-2.5 text-sm text-maroon">
          {kioskUrl}
        </code>
      </div>
    </Card>
  )
}

// A student number is optional here — court candidates are typed in by hand and
// don't need an account — but a partial one is a typo, so only a complete
// 6-digit number is accepted. The DB carries the same check constraint.
const validStudentId = (v) => v === '' || /^[0-9]{6}$/.test(v)

function HomecomingRosterCard({ gender, label, candidates, onChanged }) {
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [grade, setGrade] = useState('9')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const mine = candidates.filter((c) => c.gender === gender)
  const idOk = validStudentId(studentId)

  async function add() {
    const trimmed = name.trim()
    if (!trimmed || !idOk) return
    setAdding(true)
    setError('')
    const { error: insertError } = await supabase
      .from('homecoming_candidates')
      .insert({
        full_name: trimmed,
        student_id: studentId || null,
        grade_level: Number(grade),
        gender,
      })
    setAdding(false)
    if (insertError) {
      setError('Could not add that candidate. Please try again.')
      return
    }
    setName('')
    setStudentId('')
    onChanged()
  }

  return (
    <Card title={label} desc="Grouped by grade — voters only see their own grade.">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {HC_GRADES.map((g) => {
          const rows = mine.filter((c) => c.grade_level === g)
          return (
            <div key={g}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Grade {g}
              </p>
              {rows.length === 0 ? (
                <p className="text-sm text-gray-400">No candidates yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {rows.map((c) => (
                    <HomecomingCandidateRow
                      key={c.id}
                      candidate={c}
                      onChanged={onChanged}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <Labeled label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Candidate name"
              className={`${inputClass} w-52`}
            />
          </Labeled>
          <Labeled label="Student number (optional)">
            <input
              value={studentId}
              onChange={(e) =>
                setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(e) => e.key === 'Enter' && add()}
              inputMode="numeric"
              placeholder="123456"
              className={`${inputClass} w-36 ${
                idOk ? '' : 'border-red-300 focus:border-red-400 focus:ring-red-200'
              }`}
            />
          </Labeled>
          <Labeled label="Grade">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={`${inputClass} w-24`}
            >
              {HC_GRADES.map((g) => (
                <option key={g} value={String(g)}>
                  {g}
                </option>
              ))}
            </select>
          </Labeled>
          <button
            onClick={add}
            disabled={adding || !name.trim() || !idOk}
            className="mb-0.5 inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </div>
        {!idOk && (
          <p className="mt-2 text-xs text-red-600">
            A student number must be all six digits, or left blank.
          </p>
        )}
      </div>
    </Card>
  )
}

function HomecomingCandidateRow({ candidate, onChanged }) {
  const [name, setName] = useState(candidate.full_name)
  const [studentId, setStudentId] = useState(candidate.student_id ?? '')
  const [busy, setBusy] = useState(false)

  // Both fields save on blur; each reverts to the stored value if the edit is
  // rejected, so a failed write never leaves the row showing something the DB
  // doesn't have.
  async function rename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === candidate.full_name) {
      setName(candidate.full_name)
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase
      .from('homecoming_candidates')
      .update({ full_name: trimmed })
      .eq('id', candidate.id)
    setBusy(false)
    if (updateError) setName(candidate.full_name)
    else onChanged()
  }

  async function saveStudentId() {
    const current = candidate.student_id ?? ''
    if (studentId === current) return
    if (!validStudentId(studentId)) {
      setStudentId(current)
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase
      .from('homecoming_candidates')
      .update({ student_id: studentId || null })
      .eq('id', candidate.id)
    setBusy(false)
    if (updateError) setStudentId(current)
    else onChanged()
  }

  async function remove() {
    if (
      !window.confirm(
        `Remove ${candidate.full_name} from the ballot? Votes already cast for them are kept in the results, shown as a withdrawn candidate.`,
      )
    )
      return
    setBusy(true)
    const { error: deleteError } = await supabase
      .from('homecoming_candidates')
      .delete()
      .eq('id', candidate.id)
    setBusy(false)
    if (!deleteError) onChanged()
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        disabled={busy}
        aria-label={`Name for ${candidate.full_name}`}
        className={`${inputClass} flex-1`}
      />
      <input
        value={studentId}
        onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onBlur={saveStudentId}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        disabled={busy}
        inputMode="numeric"
        placeholder="ID"
        aria-label={`Student number for ${candidate.full_name}`}
        className={`${inputClass} w-24 shrink-0 text-center`}
      />
      <button
        onClick={remove}
        disabled={busy}
        aria-label={`Remove ${candidate.full_name}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function HomecomingResultsCard({ candidates, ballots, onChanged }) {
  const [resetting, setResetting] = useState(false)

  // One ballot row carries both picks, so a single pass over the ballots gives
  // per-candidate totals and the per-grade denominator at the same time.
  // A pick whose candidate has since been removed has a null id but kept its
  // name snapshot; those are tallied separately so the columns still reconcile
  // against the ballot count instead of quietly coming up short.
  const tally = useMemo(() => {
    const counts = {}
    const perGrade = {}
    const removed = {} // `${grade}|${gender}` -> { [name]: count }
    for (const b of ballots) {
      perGrade[b.grade_level] = (perGrade[b.grade_level] ?? 0) + 1
      const picks = [
        [b.female_candidate_id, b.female_name, 'female'],
        [b.male_candidate_id, b.male_name, 'male'],
      ]
      for (const [id, name, gender] of picks) {
        if (id) {
          counts[id] = (counts[id] ?? 0) + 1
          continue
        }
        const key = `${b.grade_level}|${gender}`
        const label = name || 'Removed candidate'
        removed[key] = removed[key] ?? {}
        removed[key][label] = (removed[key][label] ?? 0) + 1
      }
    }
    return { counts, perGrade, removed }
  }, [ballots])

  async function reset() {
    if (
      !window.confirm(
        'Delete every ballot cast so far? This cannot be undone — use it to clear test votes before real voting starts.',
      )
    )
      return
    setResetting(true)
    // No WHERE clause is possible on a plain delete, so match every real row.
    const { error: deleteError } = await supabase
      .from('homecoming_ballots')
      .delete()
      .gte('grade_level', 0)
    setResetting(false)
    if (!deleteError) onChanged()
  }

  function column(grade, gender) {
    const total = tally.perGrade[grade] ?? 0
    const rows = candidates
      .filter((c) => c.grade_level === grade && c.gender === gender)
      .map((c) => ({ ...c, votes: tally.counts[c.id] ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.full_name.localeCompare(b.full_name))

    const gone = Object.entries(tally.removed[`${grade}|${gender}`] ?? {}).sort(
      (a, b) => b[1] - a[1],
    )

    const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—')

    return (
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          {gender === 'female' ? 'Female' : 'Male'}
        </p>
        {rows.length === 0 && gone.length === 0 ? (
          <p className="text-sm text-gray-400">No candidates.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  i === 0 && c.votes > 0
                    ? 'bg-maroon/10 font-semibold text-maroon'
                    : 'text-gray-600'
                }`}
              >
                <span className="truncate">{c.full_name}</span>
                <span className="shrink-0 tabular-nums">
                  {c.votes}
                  <span className="ml-1.5 text-gray-400">{pct(c.votes)}</span>
                </span>
              </div>
            ))}
            {gone.map(([name, votes]) => (
              <div
                key={`gone-${name}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-gray-400"
              >
                <span className="truncate line-through">{name}</span>
                <span className="shrink-0 tabular-nums">
                  {votes}
                  <span className="ml-1.5">{pct(votes)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card
      title="Results"
      desc={`${ballots.length} ballot${ballots.length === 1 ? '' : 's'} cast. Percentages are of the ballots cast in that grade.`}
    >
      <div className="space-y-6">
        {HC_GRADES.map((g) => (
          <div key={g}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-display text-base font-bold text-maroon">
                Grade {g}
              </h3>
              <span className="text-sm text-gray-400">
                {tally.perGrade[g] ?? 0} ballot
                {(tally.perGrade[g] ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {column(g, 'female')}
              {column(g, 'male')}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <button
          onClick={reset}
          disabled={resetting || ballots.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Reset all ballots
        </button>
      </div>
    </Card>
  )
}
