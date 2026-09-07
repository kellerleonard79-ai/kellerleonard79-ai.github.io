import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Settings2 } from 'lucide-react'

// Dashboard pages that absorbed an Admin Panel section (Meetings, Member
// Directory, SGA Elections) show their admin controls behind a single button
// rather than a tab bar: the page has one job, and the settings are a detour
// off it, not a peer view.
//
// The mode still lives in the `?tab=` search param — deep links, the back
// button, and the /dashboard/admin/* redirects all point straight at it.
export default function ManageToggle({
  managing,
  onChange,
  label = 'Settings',
  doneLabel = 'Done',
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!managing)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        managing
          ? 'bg-maroon text-white shadow-sm hover:bg-maroon-dark'
          : 'border border-maroon/30 text-maroon hover:bg-maroon/5'
      }`}
    >
      {managing ? (
        <ArrowLeft className="h-4 w-4" />
      ) : (
        <Settings2 className="h-4 w-4" />
      )}
      {managing ? doneLabel : label}
    </button>
  )
}

// `keys` lists every `?tab=` value that means "show the admin view" — more than
// one because the old Admin Panel deep links landed on separate sections
// (?tab=positions, ?tab=settings) that are now a single page.
export function useManageMode(enabled, keys = ['settings']) {
  const [params, setParams] = useSearchParams()
  const managing = enabled && keys.includes(params.get('tab'))

  function setManaging(on) {
    const next = new URLSearchParams(params)
    if (on) next.set('tab', keys[0])
    else next.delete('tab')
    setParams(next, { replace: true })
  }

  return [managing, setManaging]
}
