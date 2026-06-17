import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Vote, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'

// Self-service candidacy management. A member running for office — including a
// pending applicant who flagged candidacy at signup — can see and change which
// position they're running for, up to a global limit, until the filing deadline.
export default function Candidacy() {
  return (
    <RequireAuth>
      <CandidacyContent />
    </RequireAuth>
  )
}

function CandidacyContent() {
  const { refreshProfile } = useAuth()
  const [candidacy, setCandidacy] = useState(null)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [{ data: c }, { data: pos }] = await Promise.all([
      supabase.rpc('my_candidacy'),
      supabase
        .from('elected_positions')
        .select('id, title, "order"')
        .eq('show_in_elections', true)
        .order('order', { ascending: true }),
    ])
    setCandidacy(c ?? null)
    setPositions(pos ?? [])
    setSelected(c?.position_id ?? '')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    const { data, error: rpcError } = await supabase.rpc(
      'set_my_candidate_position',
      { p_position_id: selected },
    )
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setCandidacy(data ?? null)
    setSelected(data?.position_id ?? selected)
    setSaved(true)
    // Declaring candidacy flips is_candidate_application on the profile; refresh
    // the cached auth profile so the dashboard's "My Application" card appears
    // immediately rather than after the next auth event or reload.
    refreshProfile()
  }

  const filingOpen =
    candidacy?.cycle_open &&
    (!candidacy?.filing_deadline ||
      new Date(candidacy.filing_deadline) > new Date())
  const hasCandidacy = Boolean(candidacy?.candidate_id)
  const changesRemaining = candidacy?.changes_remaining ?? 0
  // First-time selection is free; once they have a candidacy, changing position
  // consumes an allowance, so the limit only blocks existing candidates.
  const outOfChanges = hasCandidacy && changesRemaining <= 0
  const dirty = selected && selected !== (candidacy?.position_id ?? '')
  const canSave = filingOpen && dirty && !outOfChanges

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <div className="mt-4 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-maroon/10 text-maroon">
            <Vote className="h-5 w-5" />
          </span>
          <h1 className="font-display text-2xl font-bold text-maroon">
            My Candidacy
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-maroon" />
          </div>
        ) : !candidacy?.cycle_open ? (
          <Notice>
            There isn&apos;t an election cycle open right now. When candidate
            filing opens, you&apos;ll be able to choose the position you&apos;re
            running for here.
          </Notice>
        ) : (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <p className="text-sm text-gray-500">Election cycle</p>
                <p className="font-display text-lg font-bold text-maroon">
                  {candidacy.cycle_name ?? 'Current cycle'}
                </p>
              </div>
              {hasCandidacy && candidacy.status && (
                <span className="inline-flex items-center rounded-full bg-maroon/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-maroon">
                  {candidacy.status}
                </span>
              )}
            </div>

            {candidacy.filing_deadline && (
              <p className="mb-4 text-sm text-gray-500">
                Filing closes{' '}
                <span className="font-semibold text-maroon">
                  {new Date(candidacy.filing_deadline).toLocaleString()}
                </span>
                .
              </p>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <label htmlFor="position" className="block">
              <span className="mb-1.5 block text-sm font-semibold text-maroon">
                Position you&apos;re running for
              </span>
              <select
                id="position"
                value={selected}
                disabled={!filingOpen || outOfChanges}
                onChange={(e) => {
                  setSelected(e.target.value)
                  setSaved(false)
                }}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="" disabled>
                  Select a position…
                </option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-2 text-xs text-gray-500">
              {!filingOpen
                ? 'Filing has closed — your position can no longer be changed.'
                : !hasCandidacy
                  ? 'Choose a position to declare your candidacy.'
                  : outOfChanges
                    ? 'You have used all of your allowed position changes.'
                    : `You can change your position ${changesRemaining} more ${
                        changesRemaining === 1 ? 'time' : 'times'
                      }.`}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={save}
                disabled={!canSave || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {hasCandidacy ? 'Save position' : 'Declare candidacy'}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

function Notice({ children }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'
