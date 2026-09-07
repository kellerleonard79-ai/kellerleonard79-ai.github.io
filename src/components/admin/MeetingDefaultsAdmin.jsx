import { useEffect, useState } from 'react'
import supabase from '../../lib/supabaseClient.js'
import { useSiteSettings } from '../../lib/SiteSettingsContext.jsx'
import { meetingTitleFromFormat, todayISO } from '../../lib/format.js'
import { Card, SaveButton, inputClass } from '../ui.jsx'

// Quorum rule + default meeting title format, formerly Admin Panel → "Meeting
// Defaults". Now the Meetings page's Settings tab.

export default function MeetingDefaultsSection() {
  return (
    <div className="space-y-6">
      <QuorumCard />
      <MeetingTitleCard />
    </div>
  )
}

function QuorumCard() {
  const { settings, refresh } = useSiteSettings()
  const [type, setType] = useState('half_active')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setType(settings.quorum_type ?? 'half_active')
      setCustom(settings.quorum_custom_value ?? '')
    }
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({
        quorum_type: type,
        quorum_custom_value: type === 'custom' ? Number(custom) || 0 : null,
      })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  const OPTIONS = [
    ['half_active', 'Half of active members'],
    ['half_officers', 'Half of elected officers'],
    ['custom', 'Custom number'],
  ]

  return (
    <Card title="Quorum" desc="How the quorum threshold is calculated in QR sessions.">
      <div className="space-y-2">
        {OPTIONS.map(([val, label]) => (
          <label
            key={val}
            className="flex cursor-pointer items-center gap-2.5 text-sm text-maroon"
          >
            <input
              type="radio"
              name="quorum"
              checked={type === val}
              onChange={() => {
                setType(val)
                setSaved(false)
              }}
              className="h-4 w-4 text-maroon focus:ring-maroon/30"
            />
            {label}
          </label>
        ))}
        {type === 'custom' && (
          <input
            type="number"
            min={0}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setSaved(false)
            }}
            placeholder="Members needed"
            className={`${inputClass} mt-1 w-48`}
          />
        )}
      </div>
      <div className="mt-4">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </Card>
  )
}

function MeetingTitleCard() {
  const { settings, refresh } = useSiteSettings()
  const [format, setFormat] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings)
      setFormat(settings.default_meeting_title_format ?? 'SGA Meeting – {date}')
  }, [settings])

  async function save() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('site_settings')
      .update({ default_meeting_title_format: format })
      .eq('id', 1)
    if (!error) {
      await refresh()
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <Card
      title="Default meeting title"
      desc="Used to prefill the title when creating a meeting. Use {date} for the date."
    >
      <input
        value={format}
        onChange={(e) => {
          setFormat(e.target.value)
          setSaved(false)
        }}
        className={inputClass}
        placeholder="SGA Meeting – {date}"
      />
      <p className="mt-2 text-xs text-gray-400">
        Preview: {meetingTitleFromFormat(format, todayISO())}
      </p>
      <div className="mt-3">
        <SaveButton onClick={save} saving={saving} saved={saved} />
      </div>
    </Card>
  )
}

