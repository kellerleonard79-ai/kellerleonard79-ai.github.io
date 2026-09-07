import { useSearchParams } from 'react-router-dom'

// Tab bar for dashboard pages that absorbed an admin panel section (Member
// Directory, SGA Elections, Meetings). The active tab lives in the `?tab=`
// search param rather than component state so deep links, the back button, and
// the /dashboard/admin/* redirects can all point straight at a tab.
export default function PageTabs({ tabs, active, onChange }) {
  if (tabs.length < 2) return null
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const on = tab.key === active
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={on ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              on
                ? 'bg-maroon text-white shadow-sm'
                : 'text-gray-600 hover:bg-maroon/5 hover:text-maroon'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// Companion hook: resolves the active tab from `?tab=`, falling back to the
// first tab the viewer is allowed to see when the param is missing or names a
// tab they can't open (a stale bookmark from before a permission change).
export function usePageTab(tabs) {
  const [params, setParams] = useSearchParams()
  const keys = tabs.map((t) => t.key)
  const requested = params.get('tab')
  const active = keys.includes(requested) ? requested : keys[0]

  function setActive(key) {
    const next = new URLSearchParams(params)
    if (key === keys[0]) next.delete('tab')
    else next.set('tab', key)
    setParams(next, { replace: true })
  }

  return [active, setActive]
}
