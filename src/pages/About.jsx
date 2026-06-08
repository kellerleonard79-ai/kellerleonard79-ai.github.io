import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'
import { useSiteSettings } from '../lib/SiteSettingsContext.jsx'

// Class-officer groups, in display order. Exec is handled separately above.
const CLASS_GROUPS = [
  { key: 'senior', label: 'Senior Class' },
  { key: 'junior', label: 'Junior Class' },
  { key: 'sophomore', label: 'Sophomore Class' },
  { key: 'freshman', label: 'Freshman Class' },
]

export default function About() {
  const { settings } = useSiteSettings()
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // public_officers is a view exposing only name / photo / position for
    // members with an elected position — readable by anonymous visitors.
    supabase
      .from('public_officers')
      .select('*')
      .order('position_order', { ascending: true })
      .then(({ data }) => {
        setOfficers(data ?? [])
        setLoading(false)
      })
  }, [])

  const exec = useMemo(
    () => officers.filter((o) => o.position_group === 'exec'),
    [officers],
  )
  const byClass = useMemo(() => {
    const map = {}
    for (const o of officers) {
      if (o.position_group === 'exec') continue
      ;(map[o.position_group] ??= []).push(o)
    }
    return map
  }, [officers])

  const purpose = settings?.about_purpose_text

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-maroon-dark via-maroon to-maroon-dark py-16 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,162,74,0.18),transparent_45%)]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Crest className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-5 font-display text-4xl font-bold sm:text-5xl">
            About <span className="text-gold">SGA</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/80">
            {settings?.school_name ??
              'Pensacola High School Student Government Association'}
          </p>
        </div>
        <div className="absolute bottom-0 h-1.5 w-full bg-gradient-to-r from-gold via-gold-light to-gold" />
      </section>

      {/* Purpose */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading>Our Purpose</SectionHeading>
          <p className="mt-6 whitespace-pre-line text-center text-lg leading-relaxed text-gray-700">
            {purpose || 'Our purpose statement is coming soon.'}
          </p>
        </div>
      </section>

      {/* Officers */}
      <section className="bg-gray-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-maroon" />
            </div>
          ) : officers.length === 0 ? (
            <p className="text-center text-gray-400">
              Officers will be listed here once positions are assigned.
            </p>
          ) : (
            <>
              {/* Executive officers */}
              {exec.length > 0 && (
                <div>
                  <SectionHeading>Executive Officers</SectionHeading>
                  <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {exec.map((o) => (
                      <OfficerCard key={o.id} officer={o} />
                    ))}
                  </div>
                </div>
              )}

              {/* Class officers, grouped by grade */}
              {CLASS_GROUPS.map(({ key, label }) => {
                const list = byClass[key]
                if (!list || list.length === 0) return null
                return (
                  <div key={key} className="mt-14">
                    <h3 className="font-display text-xl font-bold text-maroon">
                      {label}
                    </h3>
                    <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-gold" />
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {list.map((o) => (
                        <OfficerCard key={o.id} officer={o} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </section>

      {/* COMMITTEES — Stage 8 */}

      <Footer />
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-3xl font-bold text-maroon sm:text-4xl">
        {children}
      </h2>
      <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-gold" />
    </div>
  )
}

function OfficerCard({ officer }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition hover:border-maroon/30 hover:shadow-md">
      <Avatar name={officer.full_name} src={officer.photo_url} />
      <p className="mt-4 font-display text-lg font-bold text-gray-900">
        {officer.full_name ?? 'Officer'}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-maroon">
        {officer.position_title}
      </p>
    </div>
  )
}

function Avatar({ name, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Officer'}
        className="h-24 w-24 rounded-full object-cover ring-2 ring-gold/40"
      />
    )
  }
  return (
    <span className="grid h-24 w-24 place-items-center rounded-full bg-maroon/10 font-display text-2xl font-bold text-maroon ring-2 ring-gold/40">
      {initials(name)}
    </span>
  )
}

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
