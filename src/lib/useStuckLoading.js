import { useEffect, useState } from 'react'

// True once `loading` has stayed true for `ms` straight. AuthContext bounds
// its own network steps internally, but this is a last-resort safety net for
// anything outside those bounds (or a future regression) — surfaces a manual
// "reload" escape instead of leaving the user staring at a spinner with no
// indication that a hard refresh would fix it. Default sits just above
// AuthContext's own worst-case bounded total so it never fires during a
// legitimately slow-but-bounded load.
export function useStuckLoading(loading, ms = 25000) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!loading) {
      setStuck(false)
      return
    }
    const timer = setTimeout(() => setStuck(true), ms)
    return () => clearTimeout(timer)
  }, [loading, ms])

  return stuck
}
