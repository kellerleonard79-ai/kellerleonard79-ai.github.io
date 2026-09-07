import { useEffect, useState } from 'react'
import supabase from '../../lib/supabaseClient.js'
import { useSiteSettings } from '../../lib/SiteSettingsContext.jsx'
import { Card, Labeled, SaveButton, inputClass } from '../ui.jsx'

// Candidacy settings, formerly Admin Panel → "Candidacy". Now the SGA Elections
// page's Settings tab, alongside the cycle is_open / filing_deadline controls
// that actually gate candidacy.

export default function CandidacySettingsSection() {
  const { settings, refresh } = useSiteSettings()
  const [limit, setLimit] = useState('3')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings)
      setLimit(String(settings.candidate_position_change_limit ?? 3))
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({
        candidate_position_change_limit: Math.max(0, Number(limit) || 0),
      })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <Card
        title="Position changes allowed"
        desc="How many times a candidate may change which position they're running for after applying. The filing deadline (set per election cycle) is the final cutoff."
      >
        <Labeled label="Changes per candidate">
          <input
            type="number"
            min={0}
            value={limit}
            onChange={(e) => {
              setLimit(e.target.value)
              setSaved(false)
            }}
            className={`${inputClass} w-40`}
          />
        </Labeled>
        <p className="mt-2 text-xs text-gray-400">
          Their first position choice is free; this limits how many times they can
          switch afterward.
        </p>
        <div className="mt-4">
          <SaveButton onClick={save} saving={saving} saved={saved} />
        </div>
      </Card>

      <ApplicationMaterialsCard />
    </div>
  )
}

// Campaign rules + endorsement form are shown to candidates in the application
// checklist modals (ApplicationDashboard). These columns previously had no admin
// editor — this closes that gap.
function ApplicationMaterialsCard() {
  const { settings, refresh } = useSiteSettings()
  const [rules, setRules] = useState('')
  const [endorseUrl, setEndorseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setRules(settings.campaign_rules_md ?? '')
      setEndorseUrl(settings.endorsement_form_url ?? '')
    }
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({
        campaign_rules_md: rules.trim() || null,
        endorsement_form_url: endorseUrl.trim() || null,
      })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <Card
      title="Application materials"
      desc="Shown to candidates as they complete their application: the campaign rules they must agree to, and the endorsement form they download, sign, and upload."
    >
      <Labeled label="Campaign rules (Markdown)">
        <textarea
          rows={6}
          value={rules}
          onChange={(e) => {
            setRules(e.target.value)
            setSaved(false)
          }}
          placeholder="Rules candidates must read and agree to before campaigning…"
          className={`${inputClass} resize-y`}
        />
      </Labeled>
      <div className="mt-3">
        <Labeled label="Endorsement form URL">
          <input
            type="url"
            value={endorseUrl}
            onChange={(e) => {
              setEndorseUrl(e.target.value)
              setSaved(false)
            }}
            placeholder="https://…  (link to the printable endorsement sheet)"
            className={inputClass}
          />
        </Labeled>
      </div>
      <div className="mt-4">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </Card>
  )
}

