import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Lock, RotateCcw, ChevronLeft } from 'lucide-react'
import { supabasePublic } from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import Crest from '../components/Crest.jsx'

// The Homecoming Court voting kiosk: a public, deliberately unlinked page a
// supervised laptop sits on all day. It never touches useAuth — a signed-out
// visitor is the expected case — and reads through the session-less client so a
// wedged login on the kiosk machine can't take voting down.
//
// Everything is sized for a stranger tapping once and walking away: big targets,
// one decision per screen, and a Start Over that is always one press away.

const GRADES = [9, 10, 11, 12]

// Order the voter walks through. `back` powers the per-step Back button.
const STEPS = ['grade', 'female', 'male', 'confirm', 'done']

export default function Kiosk() {
  const { settings, loading: settingsLoading } = useSiteSettings()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [step, setStep] = useState('grade')
  const [grade, setGrade] = useState(null)
  const [female, setFemale] = useState(null)
  const [male, setMale] = useState(null)
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
        <Step title="What grade are you in?">
          <div className="grid w-full grid-cols-2 gap-5 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGrade(g)
                  setFemale(null)
                  setMale(null)
                  setStep('female')
                }}
                className="rounded-3xl border-4 border-maroon bg-white py-12 font-display text-6xl font-bold text-maroon transition hover:bg-maroon hover:text-white active:scale-95"
              >
                {g}
              </button>
            ))}
          </div>
        </Step>
      )}

      {step === 'female' && (
        <Picker
          title="Choose one female candidate"
          subtitle={`Grade ${grade} · Step 1 of 2`}
          options={ballot.female}
          selected={female}
          onSelect={setFemale}
          onNext={() => setStep('male')}
          onBack={back}
          onReset={reset}
          emptyLabel="No candidates have been entered for this grade yet."
        />
      )}

      {step === 'male' && (
        <Picker
          title="Choose one male candidate"
          subtitle={`Grade ${grade} · Step 2 of 2`}
          options={ballot.male}
          selected={male}
          onSelect={setMale}
          onNext={() => setStep('confirm')}
          onBack={back}
          onReset={reset}
          emptyLabel="No candidates have been entered for this grade yet."
        />
      )}

      {step === 'confirm' && (
        <Step title="Is this right?">
          <div className="w-full space-y-4">
            <Summary label="Grade" value={String(grade)} />
            <Summary label="Female candidate" value={female?.full_name} />
            <Summary label="Male candidate" value={male?.full_name} />
          </div>

          {submitError && (
            <p className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-lg text-red-700">
              {submitError}
            </p>
          )}

          <div className="mt-8 flex w-full flex-col gap-4 sm:flex-row">
            <button
              onClick={back}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 px-6 py-5 text-xl font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-6 w-6" /> Go back
            </button>
            <button
              onClick={submit}
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

          <StartOver onClick={reset} disabled={submitting} />
        </Step>
      )}

      {step === 'done' && <Done onNext={reset} />}
    </Shell>
  )
}

/* ───────────────────────── layout ───────────────────────── */

// Full-bleed and chrome-less on purpose: no Navbar, no Footer, no way to
// wander off into the rest of the site from an unattended kiosk.
function Shell({ children }) {
  const { settings } = useSiteSettings()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-10 text-center">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <Crest className="h-16 w-16 object-contain" />
        <p className="mt-3 text-sm font-bold uppercase tracking-widest text-gray-400">
          {settings?.school_name || 'PHS SGA'} · Homecoming Court
        </p>
        <div className="mt-8 flex w-full flex-col items-center">{children}</div>
      </div>
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

function Picker({
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onNext,
  onBack,
  onReset,
  emptyLabel,
}) {
  return (
    <Step title={title} subtitle={subtitle}>
      {options.length === 0 ? (
        <>
          <p className="text-xl text-gray-600">{emptyLabel}</p>
          <StartOver onClick={onReset} />
        </>
      ) : (
        <>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            {options.map((c) => {
              const on = selected?.id === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  aria-pressed={on}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-4 px-6 py-7 text-left text-2xl font-semibold transition active:scale-[0.98] ${
                    on
                      ? 'border-maroon bg-maroon text-white shadow-lg'
                      : 'border-gray-200 bg-white text-maroon hover:border-maroon'
                  }`}
                >
                  {c.full_name}
                  {on && <Check className="h-7 w-7 shrink-0" />}
                </button>
              )
            })}
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
              disabled={!selected}
              className="flex-[2] rounded-2xl bg-maroon px-6 py-5 text-2xl font-bold text-white transition hover:bg-maroon-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <StartOver onClick={onReset} />
        </>
      )}
    </Step>
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

// Resets itself so the kiosk is ready for the next student without anyone
// having to touch it; the button is there for whoever doesn't want to wait.
function Done({ onNext }) {
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  useEffect(() => {
    const t = setTimeout(() => onNextRef.current(), 6000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <span className="grid h-24 w-24 place-items-center rounded-full bg-maroon text-white">
        <Check className="h-14 w-14" />
      </span>
      <h1 className="mt-8 font-display text-4xl font-bold text-maroon sm:text-5xl">
        Thanks for voting!
      </h1>
      <p className="mt-3 text-xl text-gray-600">Your ballot has been recorded.</p>
      <button
        onClick={onNext}
        className="mt-10 rounded-2xl bg-maroon px-10 py-5 text-2xl font-bold text-white transition hover:bg-maroon-dark active:scale-[0.98]"
      >
        Next voter
      </button>
    </>
  )
}
