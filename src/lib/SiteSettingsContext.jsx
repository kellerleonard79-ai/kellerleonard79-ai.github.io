import { createContext, useContext, useEffect, useState } from 'react'
import supabase from './supabaseClient.js'

const SiteSettingsContext = createContext({
  settings: null,
  loading: true,
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
  }
  if (settings.accent_color) {
    root.style.setProperty('--color-accent', settings.accent_color)
    root.style.setProperty('--color-gold', settings.accent_color)
  }
}

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

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
    <SiteSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
