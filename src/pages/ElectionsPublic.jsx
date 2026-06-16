import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BadgeCheck, Loader2, UserRound, Vote } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import supabase from '../lib/supabaseClient.js'

// Public-facing roster of everyone who has applied. Reads through the
// get_public_candidates() SECURITY DEFINER feed so no private application data
// (signatures, fallback choices, emails) is ever exposed.
export default function ElectionsPublic() {
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])

  useEffect(() => {
    let active = true
    supabase.rpc('get_public_candidates').then(({ data }) => {
      if (!active) return
      setCandidates(data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Group candidates under their position; ungrouped (no position yet) last.
  const groups = useMemo(() => {
    const map = new Map()
    for (const c of candidates) {
      const key = c.position_title ?? '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    }
    return Array.from(map.entries())
  }, [candidates])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <section className="relative overflow-hidden bg-maroon py-14 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            <Vote className="h-3.5 w-3.5" /> SGA Elections
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold uppercase tracking-wide sm:text-5xl">
            Meet the Candidates
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/75">
            Everyone running for SGA office this cycle. Provisional candidates are
            still completing their application requirements.
          </p>
        </div>
        <div className="absolute bottom-0 h-1 w-full bg-white/15" />
      </section>

      <section className="flex-1 bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-maroon" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <Vote className="mx-auto h-10 w-10 text-maroon/40" />
              <p className="mt-3 text-gray-500">
                No candidates have applied yet. Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {groups.map(([title, members]) => (
                <div key={title}>
                  <h2 className="font-display text-lg font-bold text-maroon">
                    {title === '—' ? 'Undeclared' : title}
                  </h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((c) => (
                      <CandidateCard key={c.id} candidate={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}

function CandidateCard({ candidate }) {
  const provisional = candidate.status === 'provisional'
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-maroon/8 text-maroon">
        <UserRound className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-bold text-maroon">
          {candidate.full_name}
        </h3>
        <p className="truncate text-sm text-gray-500">
          {candidate.position_title ?? 'Undeclared'}
        </p>
        <span
          className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            provisional
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {provisional ? (
            <>
              <AlertCircle className="h-3 w-3" /> Provisional Candidate
            </>
          ) : (
            <>
              <BadgeCheck className="h-3 w-3" /> Qualified Candidate
            </>
          )}
        </span>
      </div>
    </div>
  )
}
