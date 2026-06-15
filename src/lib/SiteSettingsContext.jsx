import { createContext, useContext, useEffect, useState } from 'react'
import supabase from './supabaseClient.js'

const SiteSettingsContext = createContext({
  settings: null,
  loading: true,
  refresh: async () => {},
})

// Push the admin-configurable brand colors into CSS custom properties at
// runtime. We set the semantic --color-primary / --color-accent names (the
// names the plan calls for) and also override the Tailwind theme tokens the
// existing components already consume (--color-maroon / --color-gold) so the
// live UI reflects whatever is saved in site_settings. Defaults seeded in the
// DB match the design tokens, so nothing changes visually until an admin edits.
function applyBranding(settings) {
  if (!settings) return
  const root = document.documentElement
  if (settings.primary_color) {
    root.style.setProperty('--color-primary', settings.primary_color)
    root.style.setProperty('--color-maroon', settings.primary_color)
    // The UI is intentionally maroon + white only — keep the legacy accent /
    // gold tokens locked to the primary brand color so no gold leaks back in.
    root.style.setProperty('--color-accent', settings.primary_color)
    root.style.setProperty('--color-gold', settings.primary_color)
  }
  if (settings.bg_color) {
    root.style.setProperty('--color-bg', settings.bg_color)
  }
  // Keep the browser tab title compact: use an acronym of the admin-configured
  // school name (e.g. "Pensacola High School" → "PHS") plus "SGA".
  if (settings.school_name) {
    const acronym = settings.school_name
      .replace(/\bStudent Government Association\b/i, '')
      .replace(/\bSGA\b/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join('')
    document.title = acronym ? `${acronym} SGA` : 'SGA'
  }
}

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  // Re-read the single settings row and re-apply branding. Used after an admin
  // saves changes from the Edit Site / Admin tools so the whole app reflects them.
  async function refresh() {
    const { data } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    setSettings(data ?? null)
    applyBranding(data)
    return data ?? null
  }

  useEffect(() => {
    let active = true
    supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setSettings(data ?? null)
        applyBranding(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
