import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Lock, RotateCcw, ChevronLeft } from 'lucide-react'
import { supabasePublic } from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// The Homecoming Court voting kiosk: a public, deliberately unlinked page a
// supervised laptop sits on all day. It never touches useAuth — a signed-out
// visitor is the expected case — and reads through the session-less client so a
// wedged login on the kiosk machine can't take voting down.
//
// Everything is sized for a stranger tapping once and walking away: big targets,
// one decision per screen, and a Start Over that is always one press away.

const GRADES = [9, 10, 11, 12]

// Each grade's court is titled differently; male title always listed first.
const TITLES = {
  9: { male: 'Count', female: 'Countess' },
  10: { male: 'Duke', female: 'Duchess' },
  11: { male: 'Prince', female: 'Princess' },
  12: { male: 'King', female: 'Queen' },
}

// Order the voter walks through. `back` powers the per-step Back button.
// Confirmation is a modal over 'candidates', not its own step — see `confirmOpen`.
const STEPS = ['grade', 'candidates', 'done']

export default function Kiosk() {
  const { settings, loading: settingsLoading } = useSiteSettings()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [step, setStep] = useState('grade')
  const [grade, setGrade] = useState(null)
  const [female, setFemale] = useState(null)
  const [male, setMale] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabasePublic
      .from('homecoming_candidates')
      .select('id, full_name, grade_level, gender, sort_order')
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true })
    setCandidates(data ?? [])
    setLoadError(Boolean(error))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const votingOpen = settings?.homecoming_voting_open === true

  function reset() {
    setStep('grade')
    setGrade(null)
    setFemale(null)
    setMale(null)
    setConfirmOpen(false)
    setSubmitError('')
  }

  function back() {
    setSubmitError('')
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  // Ballots are only ever grade-local — a 9th grader elects 9th-grade reps.
  const ballot = useMemo(() => {
    const inGrade = candidates.filter((c) => c.grade_level === grade)
    return {
      female: inGrade.filter((c) => c.gender === 'female'),
      male: inGrade.filter((c) => c.gender === 'male'),
    }
  }, [candidates, grade])

  async function submit() {
    setSubmitting(true)
    setSubmitError('')
    const { error } = await supabasePublic.rpc('cast_homecoming_ballot', {
      p_grade: grade,
      p_female: female.id,
      p_male: male.id,
    })
    setSubmitting(false)
    if (error) {
      // Keep the ballot intact so the voter can simply press Submit again.
      setSubmitError(
        /closed/i.test(error.message)
          ? 'Voting has closed. Please see an SGA officer.'
          : 'Something went wrong sending your vote. Please try again.',
      )
      return
    }
    setConfirmOpen(false)
    setStep('done')
  }

  if (settingsLoading || loading) {
    return (
      <Shell>
        <Loader2 className="h-12 w-12 animate-spin text-maroon" />
      </Shell>
    )
  }

  if (!votingOpen) {
    return (
      <Shell>
        <Lock className="h-16 w-16 text-maroon" />
        <h1 className="mt-6 font-display text-4xl font-bold text-maroon">
          Voting is closed
        </h1>
        <p className="mt-3 max-w-md text-xl text-gray-600">
          Homecoming Court voting isn't open right now. Check back later or ask
          an SGA officer.
        </p>
      </Shell>
    )
  }

  if (loadError) {
    return (
      <Shell>
        <h1 className="font-display text-4xl font-bold text-maroon">
          Can't load the ballot
        </h1>
        <p className="mt-3 max-w-md text-xl text-gray-600">
          Please let an SGA officer know.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      {step === 'grade' && (
        <Step title="Please Select Your Grade Level">
          <div className="grid w-full grid-cols-2 gap-5 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGrade(g)
                  setFemale(null)
                  setMale(null)
                  setStep('candidates')
                }}
                className="rounded-3xl border-4 border-maroon bg-white py-12 font-display text-6xl font-bold text-maroon transition hover:bg-maroon hover:text-white active:scale-95"
              >
                {g}
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 'candidates' && (
        <>
          <CandidatePicker
            grade={grade}
            femaleOptions={ballot.female}
            maleOptions={ballot.male}
            female={female}
            male={male}
            onSelectFemale={setFemale}
            onSelectMale={setMale}
            onNext={() => setConfirmOpen(true)}
            onBack={back}
            onReset={reset}
          />
          {confirmOpen && (
            <ConfirmModal
              grade={grade}
              female={female}
              male={male}
              submitting={submitting}
              submitError={submitError}
              onBack={() => {
                setSubmitError('')
                setConfirmOpen(false)
              }}
              onSubmit={submit}
              onReset={reset}
            />
          )}
        </>
      )}

      {step === 'done' && <Done onNext={reset} />}
    </Shell>
  )
}

/* ───────────────────────── layout ───────────────────────── */

// Full-bleed and chrome-less on purpose: no Navbar, no Footer, no way to
// wander off into the rest of the site from an unattended kiosk.
function Shell({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-10 text-center">
      <div className="flex w-full max-w-3xl flex-col items-center">{children}</div>
    </div>
  )
}

function Step({ title, subtitle, children }) {
  return (
    <>
      <h1 className="font-display text-4xl font-bold text-maroon sm:text-5xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-xl text-gray-500">{subtitle}</p>
      )}
      <div className="mt-10 flex w-full flex-col items-center">{children}</div>
    </>
  )
}

// One screen, two columns — male column always first. The column heading is
// the grade's court title (e.g. King/Queen), not "male"/"female", since that's
// what actually distinguishes the two lists for the voter.
function CandidatePicker({
  grade,
  femaleOptions,
  maleOptions,
  female,
  male,
  onSelectFemale,
  onSelectMale,
  onNext,
  onBack,
  onReset,
}) {
  const titles = TITLES[grade]
  return (
    <Step title={`Homecoming Court: ${grade}th Grade`}>
      <div className="grid w-full gap-8 sm:grid-cols-2">
        <CandidateColumn
          title={titles.male}
          options={maleOptions}
          selected={male}
          onSelect={onSelectMale}
        />
        <CandidateColumn
          title={titles.female}
          options={femaleOptions}
          selected={female}
          onSelect={onSelectFemale}
        />
      </div>

      <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row">
        <button
          onClick={onBack}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 px-6 py-5 text-xl font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <ChevronLeft className="h-6 w-6" /> Go back
        </button>
        <button
          onClick={onNext}
          disabled={!female || !male}
          className="flex-[2] rounded-2xl bg-maroon px-6 py-5 text-2xl font-bold text-white transition hover:bg-maroon-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <StartOver onClick={onReset} />
    </Step>
  )
}

// A pop-up over the selection page rather than its own step, so the voter's
// picks stay visible (and re-editable via "Go back") right behind it.
function ConfirmModal({
  grade,
  female,
  male,
  submitting,
  submitError,
  onBack,
  onSubmit,
  onReset,
}) {
  const titles = TITLES[grade]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl">
        <h1 className="font-display text-4xl font-bold text-maroon">
          Is this right?
        </h1>

        <div className="mt-8 w-full space-y-4">
          <Summary label="Grade" value={String(grade)} />
          <Summary label={titles.male} value={male?.full_name} />
          <Summary label={titles.female} value={female?.full_name} />
        </div>

        {submitError && (
          <p className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-lg text-red-700">
            {submitError}
          </p>
        )}

        <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row">
          <button
            onClick={onBack}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 px-6 py-5 text-xl font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" /> Go back
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex flex-[2] items-center justify-center gap-3 rounded-2xl bg-maroon px-6 py-5 text-2xl font-bold text-white transition hover:bg-maroon-dark active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Check className="h-7 w-7" />
            )}
            Submit my vote
          </button>
        </div>

        <StartOver onClick={onReset} disabled={submitting} />
      </div>
    </div>
  )
}

function CandidateColumn({ title, options, selected, onSelect }) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="font-display text-2xl font-bold text-maroon">{title}</h2>
      {options.length === 0 ? (
        <p className="mt-4 text-lg text-gray-600">
          No candidates have been entered for this grade yet.
        </p>
      ) : (
        <div className="mt-4 flex w-full flex-col gap-3">
          {options.map((c) => {
            const on = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                aria-pressed={on}
                className={`flex items-center justify-between gap-3 rounded-2xl border-4 px-5 py-5 text-left text-xl font-semibold transition active:scale-[0.98] ${
                  on
                    ? 'border-maroon bg-maroon text-white shadow-lg'
                    : 'border-gray-200 bg-white text-maroon hover:border-maroon'
                }`}
              >
                {c.full_name}
                {on && <Check className="h-6 w-6 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white px-6 py-5 text-left">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold text-maroon">{value}</p>
    </div>
  )
}

// Always reachable once a voter has started, so a mistake never needs staff help.
function StartOver({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-6 inline-flex items-center gap-2 text-lg font-semibold text-gray-400 underline-offset-4 transition hover:text-maroon hover:underline disabled:opacity-50"
    >
      <RotateCcw className="h-5 w-5" /> Start over
    </button>
  )
}

// Always resets itself, no button — the kiosk must be ready for the next
// student without anyone touching it.
function Done({ onNext }) {
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  useEffect(() => {
    const t = setTimeout(() => onNextRef.current(), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <span className="grid h-24 w-24 place-items-center rounded-full bg-maroon text-white">
        <Check className="h-14 w-14" />
      </span>
      <h1 className="mt-8 font-display text-4xl font-bold text-maroon sm:text-5xl">
        Thank you for your participation.
      </h1>
    </>
  )
}
