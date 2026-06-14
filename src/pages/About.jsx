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
      <section className="relative overflow-hidden bg-maroon py-16 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_100%_120%,rgba(0,0,0,0.35),transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/95 shadow-lg">
            <Crest className="h-14 w-14 object-contain" />
          </div>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
            Who We Are
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            About SGA
          </h1>
          <p className="mx-auto mt-4 max-w-md text-white/70">
            {settings?.school_name ??
              'Pensacola High School Student Government Association'}
          </p>
        </div>
      </section>

      {/* Purpose */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading eyebrow="Our Mission">Our Purpose</SectionHeading>
          <p className="mt-7 whitespace-pre-line text-center text-lg leading-relaxed text-ink-soft">
            {purpose || 'Our purpose statement is coming soon.'}
          </p>
        </div>
      </section>

      {/* Officers */}
      <section className="border-t border-line bg-mist py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-maroon" />
            </div>
          ) : officers.length === 0 ? (
            <p className="text-center text-ink-mute">
              Officers will be listed here once positions are assigned.
            </p>
          ) : (
            <>
              {/* Executive officers */}
              {exec.length > 0 && (
                <div>
                  <SectionHeading eyebrow="Leadership">
                    Executive Officers
                  </SectionHeading>
                  <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                    <div className="flex items-center gap-4">
                      <h3 className="font-display text-xl font-semibold text-maroon">
                        {label}
                      </h3>
                      <span className="h-px flex-1 bg-line-strong" />
                    </div>
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            <SectionHeading eyebrow="Getting Things Done">
              Committees
            </SectionHeading>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

function SectionHeading({ children, eyebrow }) {
  return (
    <div className="flex flex-col items-center text-center">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">
        {children}
      </h2>
      <span className="rule-accent mt-4" />
    </div>
  )
}

function OfficerCard({ officer }) {
  return (
    <div className="card-interactive flex flex-col items-center p-6 text-center">
      <Avatar name={officer.full_name} src={officer.photo_url} />
      <p className="mt-4 font-display text-lg font-semibold text-ink">
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
    <div className="card-interactive flex h-full flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-10 w-10 shrink-0">
          <UsersRound className="h-5 w-5" />
        </span>
        <h3 className="font-display text-lg font-semibold text-ink">
          {committee.name}
        </h3>
      </div>
      {committee.description && (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {committee.description}
        </p>
      )}
      {committee.members.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
          {committee.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0">
                <span className="truncate text-ink">{m.name}</span>
                {m.title && (
                  <span className="ml-1.5 text-xs text-ink-mute">
                    {m.title}
                  </span>
                )}
              </span>
              {m.isChair && (
                <span className="badge-soft">
                  <Crown className="h-3 w-3" /> Chair
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-sm text-ink-mute">
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
    <span className="grid h-24 w-24 place-items-center rounded-full bg-tint font-display text-2xl font-semibold text-maroon ring-2 ring-maroon/15">
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
