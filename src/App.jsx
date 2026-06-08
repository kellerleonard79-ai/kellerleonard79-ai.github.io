import { Routes, Route } from 'react-router-dom'
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
import MemberDirectory from './pages/MemberDirectory.jsx'
import EditSite from './pages/EditSite.jsx'
import SecurityClearance from './pages/SecurityClearance.jsx'
import Archives from './pages/Archives.jsx'
import Elections from './pages/Elections.jsx'
import Bookkeeping from './pages/Bookkeeping.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/join" element={<Join />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/profile" element={<Profile />} />
      <Route path="/dashboard/edit-site" element={<EditSite />} />
      <Route path="/dashboard/security" element={<SecurityClearance />} />
      <Route path="/dashboard/archives" element={<Archives />} />
      <Route path="/dashboard/elections" element={<Elections />} />
      <Route path="/dashboard/bookkeeping" element={<Bookkeeping />} />
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
