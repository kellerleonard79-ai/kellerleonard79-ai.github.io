import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import Crest from '../components/Crest.jsx'
import supabase from '../lib/supabaseClient.js'
import { useAuth } from '../lib/AuthContext.jsx'

// status: loading | success | already | inactive | notfound | error
export default function Checkin() {
  const { meetingId } = useParams()
  const { loading, session, profile } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState('loading')
  const [meeting, setMeeting] = useState(null)
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  // Not signed in → send to login, then come right back here to check in.
  useEffect(() => {
    if (!loading && !session) {
      navigate(`/login?redirect=/checkin/${meetingId}`, { replace: true })
    }
  }, [loading, session, meetingId, navigate])

  useEffect(() => {
    if (loading || !session || !profile || ran.current) return
    ran.current = true

    async function checkIn() {
      const { data: meetingRow, error: meetingError } = await supabase
        .from('meetings')
        .select('id, title, date, is_active')
        .eq('id', meetingId)
        .maybeSingle()

      if (meetingError || !meetingRow) {
        setStatus('notfound')
        return
      }
      setMeeting(meetingRow)

      if (!meetingRow.is_active) {
        setStatus('inactive')
        return
      }

      const { error: insertError } = await supabase
        .from('attendance')
        .insert({ meeting_id: meetingId, profile_id: profile.id })

      if (insertError) {
        // 23505 = unique_violation → they already checked in.
        if (insertError.code === '23505') {
          setStatus('already')
        } else {
          setStatus('error')
          setMessage(insertError.message)
        }
        return
      }
      setStatus('success')
    }

    checkIn()
  }, [loading, session, profile, meetingId])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <section className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Crest className="mx-auto h-14 w-14 object-contain" />

          {status === 'loading' && (
            <Result
              icon={<Loader2 className="h-12 w-12 animate-spin text-maroon" />}
              title="Checking you in…"
            />
          )}

          {status === 'success' && (
            <Result
              icon={<CheckCircle2 className="h-12 w-12 text-green-600" />}
              title="You're checked in!"
              sub={`Attendance recorded for ${meeting?.title}. Welcome, ${profile?.full_name?.split(' ')[0] ?? 'Tiger'}!`}
            />
          )}

          {status === 'already' && (
            <Result
              icon={<CheckCircle2 className="h-12 w-12 text-maroon" />}
              title="Already checked in"
              sub={`You're already on the roster for ${meeting?.title}.`}
            />
          )}

          {status === 'inactive' && (
            <Result
              icon={<Clock className="h-12 w-12 text-amber-500" />}
              title="Check-in not open"
              sub={`"${meeting?.title}" isn't currently active. Check-in opens when an officer starts the meeting.`}
            />
          )}

          {status === 'notfound' && (
            <Result
              icon={<XCircle className="h-12 w-12 text-red-500" />}
              title="Meeting not found"
              sub="That check-in link is invalid or the meeting was removed."
            />
          )}

          {status === 'error' && (
            <Result
              icon={<XCircle className="h-12 w-12 text-red-500" />}
              title="Something went wrong"
              sub={message || 'Please try scanning again.'}
            />
          )}

          <Link
            to="/"
            className="mt-6 inline-flex rounded-lg bg-maroon px-5 py-2.5 font-semibold text-white transition hover:bg-maroon-dark"
          >
            Back to Home
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  )
}

function Result({ icon, title, sub }) {
  return (
    <>
      <div className="mt-5 flex justify-center">{icon}</div>
      <h1 className="mt-4 font-display text-2xl font-bold text-maroon">
        {title}
      </h1>
      {sub && <p className="mt-2 text-gray-600">{sub}</p>}
    </>
  )
}
