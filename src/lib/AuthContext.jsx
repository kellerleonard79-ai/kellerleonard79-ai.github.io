import { createContext, useContext, useEffect, useState } from 'react'
import supabase from './supabaseClient.js'

const AuthContext = createContext({
  session: null,
  profile: null,
  loading: true,
  hasPermission: () => false,
  signOut: async () => {},
})

// Pull the profile together with its role row (incl. the permissions jsonb) via
// the profiles.role_id -> roles FK. The role lands on `profile.role`.
async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*, role:roles(*)')
    .eq('id', userId)
    .single()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return
      setSession(session)
      setProfile(session?.user ? await fetchProfile(session.user.id) : null)
      if (active) setLoading(false)
    }
    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setProfile(
        newSession?.user ? await fetchProfile(newSession.user.id) : null,
      )
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Permission check driven by the role's permissions jsonb. The admin tier
  // (is_admin) implicitly passes every check; a missing role denies everything.
  const role = profile?.role ?? null
  function hasPermission(key) {
    if (!role) return false
    if (role.is_admin) return true
    return role.permissions?.[key] === true
  }

  const value = {
    session,
    profile,
    role,
    loading,
    hasPermission,
    // Kept for backward compatibility while components migrate to hasPermission.
    isStaff: profile?.clearance_level === 'admin' || profile?.clearance_level === 'officer',
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
