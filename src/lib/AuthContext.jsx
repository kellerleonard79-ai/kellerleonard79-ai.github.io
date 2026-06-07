import { createContext, useContext, useEffect, useState } from 'react'
import supabase from './supabaseClient.js'

const AuthContext = createContext({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
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

  const value = {
    session,
    profile,
    loading,
    isStaff: profile?.clearance_level === 'admin' || profile?.clearance_level === 'officer',
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
