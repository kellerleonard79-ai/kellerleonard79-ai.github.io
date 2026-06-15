import { useEffect, useMemo, useState } from 'react'
import { Loader2, Crown, UsersRound } from 'lucide-react'
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
  const [committeeRows, setCommitteeRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Both views expose only public-facing columns and are readable by
    // anonymous visitors. public_officers: name/photo/position for members with
    // an elected position. public_committees: one row per committee membership
    // (committees with no members still appear, with null member columns).
    Promise.all([
      supabase
        .from('public_officers')
        .select('*')
        .order('position_order', { ascending: true }),
      supabase
        .from('public_committees')
        .select('*')
        .order('committee_name', { ascending: true }),
    ]).then(([{ data: offs }, { data: cmts }]) => {
      setOfficers(offs ?? [])
      setCommitteeRows(cmts ?? [])
      setLoading(false)
    })
  }, [])

  // Fold the flat membership rows into one entry per committee. Chair first,
  // then members alphabetically.
  const committees = useMemo(() => {
    const map = new Map()
    for (const row of committeeRows) {
      let c = map.get(row.committee_id)
      if (!c) {
        c = {
          id: row.committee_id,
          name: row.committee_name,
          description: row.committee_description,
          members: [],
        }
        map.set(row.committee_id, c)
      }
      if (row.membership_id) {
        c.members.push({
          id: row.membership_id,
          name: row.member_name,
          title: row.member_position_title,
          isChair: row.is_chair,
        })
      }
    }
    const list = [...map.values()]
    for (const c of list) {
      c.members.sort((a, b) => {
        if (a.isChair !== b.isChair) return a.isChair ? -1 : 1
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
    }
    return list
  }, [committeeRows])

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
      <section className="relative overflow-hidden bg-maroon py-8 text-white">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-maroon-dark via-maroon to-maroon-light opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_45%)]" />
        <div className="relative mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 sm:px-6">
          <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-wide sm:text-4xl">
            About Us
          </h1>
          <Crest className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" />
        </div>
        <div className="absolute bottom-0 h-1 w-full bg-white/15" />
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
                    <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-maroon" />
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

      {/* Committees */}
      {!loading && committees.length > 0 && (
        <section className="bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading>Committees</SectionHeading>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {committees.map((c) => (
                <CommitteeCard key={c.id} committee={c} />
              ))}
            </div>
          </div>
        </section>
      )}

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
      <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-maroon" />
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

function CommitteeCard({ committee }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-maroon/30 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon/8 text-maroon">
          <UsersRound className="h-5 w-5" />
        </span>
        <h3 className="font-display text-lg font-bold text-gray-900">
          {committee.name}
        </h3>
      </div>
      {committee.description && (
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          {committee.description}
        </p>
      )}
      {committee.members.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
          {committee.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0">
                <span className="truncate text-gray-800">{m.name}</span>
                {m.title && (
                  <span className="ml-1.5 text-xs text-gray-400">
                    {m.title}
                  </span>
                )}
              </span>
              {m.isChair && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-maroon/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-maroon">
                  <Crown className="h-3 w-3 text-maroon" /> Chair
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-400">
          Members to be announced.
        </p>
      )}
    </div>
  )
}

function Avatar({ name, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Officer'}
        className="h-24 w-24 rounded-full object-cover ring-2 ring-maroon/20"
      />
    )
  }
  return (
    <span className="grid h-24 w-24 place-items-center rounded-full bg-maroon/10 font-display text-2xl font-bold text-maroon ring-2 ring-maroon/20">
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
