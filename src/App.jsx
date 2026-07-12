import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Join from './pages/Join.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Meetings from './pages/Meetings.jsx'
import MeetingDetail from './pages/MeetingDetail.jsx'
import AgendaEditor from './pages/AgendaEditor.jsx'
import SessionView from './pages/SessionView.jsx'
import Checkin from './pages/Checkin.jsx'
import Profile from './pages/Profile.jsx'
import ApplicationDashboard from './pages/ApplicationDashboard.jsx'
import ElectionsPublic from './pages/ElectionsPublic.jsx'
import MemberDirectory from './pages/MemberDirectory.jsx'
import Archives from './pages/Archives.jsx'
import Elections from './pages/Elections.jsx'
import Bookkeeping from './pages/Bookkeeping.jsx'
import Committees from './pages/Committees.jsx'
import Assignments from './pages/Assignments.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'
import ClockWarning from './components/ClockWarning.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// The standalone Edit Site and Security Clearance pages were folded into the
// unified Admin panel; their old routes now redirect to the matching section.

export default function App() {
  return (
    <>
      {/* Sits outside the routed pages so it still surfaces when a skewed
          device clock has broken auth and the pages themselves render empty. */}
      <ClockWarning />
      <ErrorBoundary>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/elections" element={<ElectionsPublic />} />
      <Route path="/join" element={<Join />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Officer/member area: one persistent sidebar shell (DashboardLayout)
          wraps every /dashboard/* route so tools stay one click apart and the
          sidebar never remounts on navigation. */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        {/* Candidacy + application were merged into one page; keep the old
            deep link working. */}
        <Route
          path="candidacy"
          element={<Navigate to="/dashboard/application" replace />}
        />
        <Route path="application" element={<ApplicationDashboard />} />
        <Route
          path="edit-site"
          element={<Navigate to="/dashboard/admin/announcements" replace />}
        />
        <Route
          path="security"
          element={<Navigate to="/dashboard/admin/members" replace />}
        />
        {/* Assigning work moved out of the Admin committee-tasks tab into its
            own console; keep old deep links working. */}
        <Route
          path="admin/committee-tasks"
          element={<Navigate to="/dashboard/assignments" replace />}
        />
        <Route path="assignments" element={<Assignments />} />
        <Route path="admin" element={<AdminSettings />} />
        <Route path="admin/:section" element={<AdminSettings />} />
        <Route path="archives" element={<Archives />} />
        <Route path="elections" element={<Elections />} />
        <Route path="bookkeeping" element={<Bookkeeping />} />
        <Route path="committees" element={<Committees />} />
        <Route path="members" element={<MemberDirectory />} />
        <Route path="members/:id" element={<Profile />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="meetings/:id/agenda" element={<AgendaEditor />} />
        <Route path="meetings/:id/session" element={<SessionView />} />
      </Route>

      {/* QR check-in is a public landing, intentionally outside the shell. */}
      <Route path="/checkin/:meetingId" element={<Checkin />} />
      {/* Catch-all: an unmatched path otherwise renders nothing (blank page). */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </>
  )
}
