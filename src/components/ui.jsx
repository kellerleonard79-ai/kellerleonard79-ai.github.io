import { Check, Loader2 } from 'lucide-react'

// Small presentational primitives shared by the dashboard pages and the admin
// sections they now host. These grew up inside AdminSettings.jsx and were
// copy-pasted into Assignments.jsx; they live here so the sections that moved
// out to Meetings / Member Directory / Elections keep the same look.

export function Card({ title, desc, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {(title || desc) && (
        <div className="border-b border-gray-100 p-5">
          {title && (
            <h2 className="font-display text-lg font-bold text-maroon">
              {title}
            </h2>
          )}
          {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-maroon shadow-sm outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20'

export function SaveButton({ onClick, saving, saved, disabled, label = 'Save changes' }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-sm text-green-600">
          <Check className="h-4 w-4" /> Saved
        </span>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-maroon">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-7 w-7 animate-spin text-maroon" />
    </div>
  )
}

export function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
