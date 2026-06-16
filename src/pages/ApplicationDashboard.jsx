import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileSignature,
  Loader2,
  Trophy,
  Upload,
  Vote,
  X,
} from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Markdown from '../components/Markdown.jsx'
import RequireAuth from '../components/RequireAuth.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'
import supabase from '../lib/supabaseClient.js'

// The four modules and their derived statuses are the whole game here. Status is
// computed from one source of truth — the applicant row + booked slot — so the
// dashboard, badges, and modals never drift apart.
const STATUS = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-500' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  action_required: { label: 'Action Required', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
}

export default function ApplicationDashboard() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  )
}

function Content() {
  const { profile } = useAuth()
  const { settings } = useSiteSettings()

  const [loading, setLoading] = useState(true)
  const [applicant, setApplicant] = useState(null)
  const [positions, setPositions] = useState([])
  const [sessions, setSessions] = useState([]) // [{ ...session, slots: [] }]
  const [activeModal, setActiveModal] = useState(null)
  // "Skipped endorsements" is intentionally local + persisted per user, so the
  // Action Required state survives reloads without a schema change.
  const skipKey = `endorse_skip_${profile?.id}`
  const [skipped, setSkipped] = useState(
    () => localStorage.getItem(`endorse_skip_${profile?.id}`) === '1',
  )

  const loadApplicant = useCallback(async () => {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .eq('member_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
    return data?.[0] ?? null
  }, [profile.id])

  const loadSessions = useCallback(async () => {
    const { data: sess } = await supabase
      .from('interview_sessions')
      .select('*')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    const withSlots = await Promise.all(
      (sess ?? []).map(async (s) => {
        const { data: slots } = await supabase.rpc('get_session_slots', {
          p_session_id: s.id,
        })
        return { ...s, slots: slots ?? [] }
      }),
    )
    return withSlots
  }, [])

  const refresh = useCallback(async () => {
    const [a, p, s] = await Promise.all([
      loadApplicant(),
      supabase.from('positions').select('*').order('title'),
      loadSessions(),
    ])
    setApplicant(a)
    setPositions(p.data ?? [])
    setSessions(s)
  }, [loadApplicant, loadSessions])

  useEffect(() => {
    let active = true
    ;(async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  // Lazily create the applicant draft the first time any module is saved, so a
  // user can complete the modules in any order.
  const ensureApplicant = useCallback(async () => {
    if (applicant) return applicant
    const { data, error } = await supabase
      .from('applicants')
      .insert({ member_id: profile.id, student_id: profile.student_id })
      .select('*')
      .single()
    if (error) throw error
    setApplicant(data)
    return data
  }, [applicant, profile.id, profile.student_id])

  const bookedSlot = useMemo(() => {
    for (const s of sessions) {
      const mine = s.slots.find((sl) => sl.is_mine)
      if (mine) return { ...mine, session: s }
    }
    return null
  }, [sessions])

  // --- Module status derivation -------------------------------------------
  const statuses = useMemo(() => {
    const positionStatus = applicant?.position_id
      ? applicant?.fallback_to_general
        ? 'completed'
        : 'in_progress'
      : 'not_started'
    const rulesStatus = applicant?.rules_acknowledged ? 'completed' : 'not_started'
    const endorseStatus = applicant?.signature_doc_url
      ? 'completed'
      : skipped
        ? 'action_required'
        : 'not_started'
    const interviewStatus = bookedSlot ? 'completed' : 'not_started'
    return {
      position: positionStatus,
      rules: rulesStatus,
      endorsements: endorseStatus,
      interview: interviewStatus,
    }
  }, [applicant, skipped, bookedSlot])

  const completedCount = Object.values(statuses).filter((s) => s === 'completed')
    .length

  // --- Module handlers ----------------------------------------------------
  async function savePosition(positionId, fallback) {
    const row = await ensureApplicant()
    const { data } = await supabase
      .from('applicants')
      .update({ position_id: positionId, fallback_to_general: fallback })
      .eq('id', row.id)
      .select('*')
      .single()
    if (data) setApplicant(data)
    setActiveModal(null)
  }

  async function agreeRules() {
    const row = await ensureApplicant()
    const { data } = await supabase
      .from('applicants')
      .update({ rules_acknowledged: true })
      .eq('id', row.id)
      .select('*')
      .single()
    if (data) setApplicant(data)
    setActiveModal(null)
  }

  async function uploadEndorsement(file) {
    const row = await ensureApplicant()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'dat'
    const path = `${profile.id}/endorsement-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('applications')
      .upload(path, file, { upsert: true })
    if (upErr) throw upErr
    const { data } = await supabase
      .from('applicants')
      .update({ signature_doc_url: path })
      .eq('id', row.id)
      .select('*')
      .single()
    if (data) setApplicant(data)
    localStorage.removeItem(skipKey)
    setSkipped(false)
    setActiveModal(null)
  }

  function skipEndorsement() {
    localStorage.setItem(skipKey, '1')
    setSkipped(true)
    setActiveModal(null)
  }

  async function bookSlot(slotId) {
    const { error } = await supabase.rpc('book_interview_slot', {
      p_slot_id: slotId,
    })
    if (error) throw error
    setSessions(await loadSessions())
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-maroon" />
      </div>
    )
  }

  const fullyQualified = applicant?.status === 'fully_qualified'

  const modules = [
    {
      key: 'position',
      icon: Vote,
      title: 'Choose Your Position',
      desc: 'Select the office you’re running for.',
      status: statuses.position,
    },
    {
      key: 'rules',
      icon: ClipboardList,
      title: 'Constitution & Campaign Rules',
      desc: 'Read the rules and confirm your agreement.',
      status: statuses.rules,
    },
    {
      key: 'endorsements',
      icon: FileSignature,
      title: 'Physical Endorsements',
      desc: 'Upload a photo of your signed endorsement sheet.',
      status: statuses.endorsements,
    },
    {
      key: 'interview',
      icon: CalendarClock,
      title: 'Schedule Your Interview',
      desc: 'Pick an available interview time slot.',
      status: statuses.interview,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-maroon"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {/* Header + overall progress */}
        <header className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-maroon">
                Election Application
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Complete every step to finalize your candidacy.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                fullyQualified
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {fullyQualified ? (
                <>
                  <Trophy className="h-3.5 w-3.5" /> Fully Qualified
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5" /> Provisional
                </>
              )}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500">
              <span>{completedCount} of {modules.length} complete</span>
              <span>{Math.round((completedCount / modules.length) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-maroon transition-all"
                style={{ width: `${(completedCount / modules.length) * 100}%` }}
              />
            </div>
          </div>
        </header>

        {/* The list-format checklist — all four modules at once */}
        <ul className="mt-6 space-y-3">
          {modules.map((m) => (
            <ChecklistItem
              key={m.key}
              {...m}
              onClick={() => setActiveModal(m.key)}
            />
          ))}
        </ul>
      </div>

      <Footer />

      {/* Modals */}
      {activeModal === 'position' && (
        <PositionModal
          positions={positions}
          applicant={applicant}
          onSave={savePosition}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'rules' && (
        <RulesModal
          settings={settings}
          applicant={applicant}
          onAgree={agreeRules}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'endorsements' && (
        <EndorsementsModal
          settings={settings}
          applicant={applicant}
          onUpload={uploadEndorsement}
          onSkip={skipEndorsement}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'interview' && (
        <InterviewModal
          sessions={sessions}
          bookedSlot={bookedSlot}
          onBook={bookSlot}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Checklist row
// ---------------------------------------------------------------------------
function ChecklistItem({ icon: Icon, title, desc, status, onClick }) {
  const s = STATUS[status]
  const done = status === 'completed'
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-maroon/30 hover:shadow-md"
      >
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
            done
              ? 'bg-green-100 text-green-700'
              : 'bg-maroon/8 text-maroon group-hover:bg-maroon group-hover:text-white'
          }`}
        >
          {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-maroon">
            {title}
          </span>
          <span className="block text-sm text-gray-500">{desc}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}
        >
          {s.label}
        </span>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------
function Modal({ title, icon: Icon, onClose, children, footer }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-maroon">
            {Icon && <Icon className="h-5 w-5" />} {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-maroon"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="border-t border-gray-100 px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

function AsyncButton({ onClick, disabled, children, className }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function run() {
    setErr('')
    setBusy(true)
    try {
      await onClick()
    } catch (e) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      {err && (
        <p className="mb-2 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {err}
        </p>
      )}
      <button
        onClick={run}
        disabled={disabled || busy}
        className={`flex w-full items-center justify-center gap-2 rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module 1 — Position Selector
// ---------------------------------------------------------------------------
function PositionModal({ positions, applicant, onSave, onClose }) {
  const startIndex = Math.max(
    0,
    positions.findIndex((p) => p.id === applicant?.position_id),
  )
  const [index, setIndex] = useState(startIndex)
  const [fallback, setFallback] = useState(applicant?.fallback_to_general ?? false)

  if (positions.length === 0) {
    return (
      <Modal title="Choose Your Position" icon={Vote} onClose={onClose}>
        <p className="text-sm text-gray-500">
          No positions are open for applications right now. Check back soon.
        </p>
      </Modal>
    )
  }

  const current = positions[index]
  const move = (dir) =>
    setIndex((i) => (i + dir + positions.length) % positions.length)

  return (
    <Modal
      title="Choose Your Position"
      icon={Vote}
      onClose={onClose}
      footer={
        <AsyncButton
          onClick={() => onSave(current.id, fallback)}
          disabled={!fallback}
        >
          <Check className="h-4 w-4" /> Confirm {current.title}
        </AsyncButton>
      }
    >
      {/* Carousel header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => move(-1)}
          className="rounded-lg border border-gray-200 p-2 text-maroon transition hover:bg-maroon/5"
          aria-label="Previous position"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Position {index + 1} of {positions.length}
          </p>
          <h3 className="font-display text-xl font-bold text-maroon">
            {current.title}
          </h3>
        </div>
        <button
          onClick={() => move(1)}
          className="rounded-lg border border-gray-200 p-2 text-maroon transition hover:bg-maroon/5"
          aria-label="Next position"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {current.description && (
        <div className="mt-4">
          <Markdown>{current.description}</Markdown>
        </div>
      )}

      {Array.isArray(current.requirements) && current.requirements.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Requirements
          </p>
          <ul className="mt-2 space-y-1.5">
            {current.requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-maroon" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mandatory fallback acknowledgement */}
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <input
          type="checkbox"
          checked={fallback}
          onChange={(e) => setFallback(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30"
        />
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-maroon">Required:</span> If I&apos;m
          not elected to this position, place me in the general applicant pool.
        </span>
      </label>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Module 2 — Constitution & Rules
// ---------------------------------------------------------------------------
function RulesModal({ settings, applicant, onAgree, onClose }) {
  const [agreed, setAgreed] = useState(applicant?.rules_acknowledged ?? false)
  const rules = settings?.campaign_rules_md

  return (
    <Modal
      title="Constitution & Campaign Rules"
      icon={ClipboardList}
      onClose={onClose}
      footer={
        <AsyncButton onClick={onAgree} disabled={!agreed}>
          <Check className="h-4 w-4" /> Read and Agree
        </AsyncButton>
      }
    >
      {settings?.constitution_url && (
        <a
          href={settings.constitution_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
        >
          <Download className="h-4 w-4" /> Download the Constitution
        </a>
      )}

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        {rules ? (
          <Markdown>{rules}</Markdown>
        ) : (
          <p className="text-sm text-gray-500">
            Campaign rules haven&apos;t been published yet.
          </p>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon/30"
        />
        <span className="text-sm text-gray-600">
          I have read and agree to abide by the SGA Constitution and the campaign
          rules above.
        </span>
      </label>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Module 3 — Physical Endorsements
// ---------------------------------------------------------------------------
const ACCEPTED = ['image/png', 'image/jpeg', 'application/pdf']

function EndorsementsModal({ settings, applicant, onUpload, onSkip, onClose }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const uploaded = applicant?.signature_doc_url

  function pick(f) {
    setError('')
    if (!f) return
    if (!ACCEPTED.includes(f.type)) {
      setError('Please choose a .png, .jpeg, or .pdf file.')
      return
    }
    setFile(f)
  }

  return (
    <Modal
      title="Physical Endorsements"
      icon={FileSignature}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <AsyncButton onClick={() => onUpload(file)} disabled={!file}>
            <Upload className="h-4 w-4" /> Upload Endorsements
          </AsyncButton>
          <button
            onClick={onSkip}
            className="w-full rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
          >
            Skip for now
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">
        Print the endorsement sheet, collect the required signatures, then upload
        a clear photo or scan.
      </p>

      {settings?.endorsement_form_url && (
        <a
          href={settings.endorsement_form_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon transition hover:bg-maroon/5"
        >
          <Download className="h-4 w-4" /> Download Endorsement Form (PDF)
        </a>
      )}

      {uploaded && !file && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Endorsements already on file. Upload
          again to replace.
        </p>
      )}

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 text-center transition hover:border-maroon/40 hover:bg-maroon/5">
        <Upload className="h-6 w-6 text-maroon" />
        <span className="text-sm font-medium text-maroon">
          {file ? file.name : 'Click to choose a file'}
        </span>
        <span className="text-xs text-gray-400">PNG, JPEG, or PDF</span>
        <input
          type="file"
          accept=".png,.jpeg,.jpg,.pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Module 4 — Interview Scheduler
// ---------------------------------------------------------------------------
function InterviewModal({ sessions, bookedSlot, onBook, onClose }) {
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  const fmtDate = (d) =>
    new Date(`${d}T00:00:00`).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

  return (
    <Modal title="Schedule Your Interview" icon={CalendarClock} onClose={onClose}>
      {bookedSlot && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> You&apos;re booked for{' '}
          {fmtTime(bookedSlot.start_time)} on {fmtDate(bookedSlot.session.date)}.
        </p>
      )}

      {sessions.length === 0 && (
        <p className="text-sm text-gray-500">
          No interview sessions have been scheduled yet. Check back soon.
        </p>
      )}

      <div className="space-y-5">
        {sessions.map((s) => (
          <div key={s.id}>
            <h3 className="font-display text-sm font-bold text-maroon">
              {fmtDate(s.date)}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.slots.map((slot) => {
                const taken = slot.is_booked || !slot.is_available
                const mine = slot.is_mine
                // Once you hold a slot anywhere, the others stay visible but
                // locked — one interview per applicant.
                const lockedOut = Boolean(bookedSlot) && !mine
                const disabled = taken || lockedOut

                return (
                  <SlotButton
                    key={slot.id}
                    label={fmtTime(slot.start_time)}
                    mine={mine}
                    disabled={disabled}
                    reason={
                      mine
                        ? 'Your slot'
                        : !slot.is_available
                          ? 'Unavailable'
                          : slot.is_booked
                            ? 'Taken'
                            : null
                    }
                    onBook={() => onBook(slot.id)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function SlotButton({ label, mine, disabled, reason, onBook }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    setErr('')
    setBusy(true)
    try {
      await onBook()
    } catch (e) {
      setErr(e.message || 'Could not book.')
    } finally {
      setBusy(false)
    }
  }

  const base =
    'flex flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-sm font-semibold transition'
  if (mine) {
    return (
      <div className={`${base} border-green-300 bg-green-50 text-green-700`}>
        <Check className="mb-0.5 h-4 w-4" />
        {label}
      </div>
    )
  }
  if (disabled) {
    return (
      <div
        className={`${base} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}
        title={reason ?? undefined}
      >
        <span className="line-through">{label}</span>
        {reason && <span className="text-[10px] font-medium">{reason}</span>}
      </div>
    )
  }
  return (
    <button
      onClick={run}
      disabled={busy}
      title={err || undefined}
      className={`${base} border-maroon/30 bg-white text-maroon hover:border-maroon hover:bg-maroon hover:text-white disabled:opacity-60`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  )
}
