import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Join from './pages/Join.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Meetings from './pages/Meetings.jsx'
import MeetingDetail from './pages/MeetingDetail.jsx'
import AgendaEditor from './pages/AgendaEditor.jsx'
import SessionView from './pages/SessionView.jsx'
import Checkin from './pages/Checkin.jsx'
import Profile from './pages/Profile.jsx'
import Candidacy from './pages/Candidacy.jsx'
import MemberDirectory from './pages/MemberDirectory.jsx'
import Archives from './pages/Archives.jsx'
import Elections from './pages/Elections.jsx'
import Bookkeeping from './pages/Bookkeeping.jsx'
import Committees from './pages/Committees.jsx'
import AdminSettings from './pages/AdminSettings.jsx'

// The standalone Edit Site and Security Clearance pages were folded into the
// unified Admin panel; their old routes now redirect to the matching section.

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/join" element={<Join />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/profile" element={<Profile />} />
      <Route path="/dashboard/candidacy" element={<Candidacy />} />
      <Route
        path="/dashboard/edit-site"
        element={<Navigate to="/dashboard/admin/announcements" replace />}
      />
      <Route
        path="/dashboard/security"
        element={<Navigate to="/dashboard/admin/members" replace />}
      />
      <Route path="/dashboard/admin" element={<AdminSettings />} />
      <Route path="/dashboard/admin/:section" element={<AdminSettings />} />
      <Route path="/dashboard/archives" element={<Archives />} />
      <Route path="/dashboard/elections" element={<Elections />} />
      <Route path="/dashboard/bookkeeping" element={<Bookkeeping />} />
      <Route path="/dashboard/committees" element={<Committees />} />
      <Route path="/dashboard/members" element={<MemberDirectory />} />
      <Route path="/dashboard/members/:id" element={<Profile />} />
      <Route path="/dashboard/meetings" element={<Meetings />} />
      <Route path="/dashboard/meetings/:id" element={<MeetingDetail />} />
      <Route path="/dashboard/meetings/:id/agenda" element={<AgendaEditor />} />
      <Route path="/dashboard/meetings/:id/session" element={<SessionView />} />
      <Route path="/checkin/:meetingId" element={<Checkin />} />
    </Routes>
  )
}
