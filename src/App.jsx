import { Routes, Route, Navigate, useParams } from 'react-router-dom'
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
import Kiosk from './pages/Kiosk.jsx'
import Profile from './pages/Profile.jsx'
import ApplicationDashboard from './pages/ApplicationDashboard.jsx'
import ElectionsPublic from './pages/ElectionsPublic.jsx'
import MemberDirectory from './pages/MemberDirectory.jsx'
import Archives from './pages/Archives.jsx'
import Elections from './pages/Elections.jsx'
import Bookkeeping from './pages/Bookkeeping.jsx'
import Committees from './pages/Committees.jsx'
import Assignments from './pages/Assignments.jsx'
import EditSite from './pages/EditSite.jsx'
import CourtElections from './pages/CourtElections.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'
import ClockWarning from './components/ClockWarning.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// The unified Admin panel was unwound: every section that belonged to a
// dashboard tool moved onto that tool's own page, and what was left became Edit
// Site. This maps the old /dashboard/admin/<section> deep links onto wherever
// each section lives now, so bookmarks and in-app links keep working.
const ADMIN_SECTION_HOMES = {
  announcements: '/dashboard/edit-site/announcements',
  join: '/dashboard/edit-site/join',
  about: '/dashboard/edit-site/about',
  calendar: '/dashboard/edit-site/calendar',
  contact: '/dashboard/edit-site/contact',
  newsletter: '/dashboard/edit-site/newsletter',
  members: '/dashboard/members?tab=settings',
  tiers: '/dashboard/members?tab=settings',
  positions: '/dashboard/elections?tab=positions',
  candidacy: '/dashboard/elections?tab=settings',
  sections: '/dashboard/meetings?tab=settings',
  meetings: '/dashboard/meetings?tab=settings',
  homecoming: '/dashboard/court',
}

function AdminSectionRedirect() {
  const { section } = useParams()
  return (
    <Navigate to={ADMIN_SECTION_HOMES[section] ?? '/dashboard/edit-site'} replace />
  )
}

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
        <Route path="edit-site" element={<EditSite />} />
        <Route path="edit-site/:section" element={<EditSite />} />
        <Route
          path="security"
          element={<Navigate to="/dashboard/members?tab=settings" replace />}
        />
        {/* Assigning work moved out of the Admin committee-tasks tab into its
            own console; keep old deep links working. */}
        <Route
          path="admin/committee-tasks"
          element={<Navigate to="/dashboard/assignments" replace />}
        />
        <Route path="assignments" element={<Assignments />} />
        <Route path="admin" element={<Navigate to="/dashboard/edit-site" replace />} />
        <Route path="admin/:section" element={<AdminSectionRedirect />} />
        <Route path="archives" element={<Archives />} />
        <Route path="elections" element={<Elections />} />
        <Route path="court" element={<CourtElections />} />
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
      {/* Homecoming voting kiosk: fully public and deliberately unlinked —
          reachable only by typing the URL, so nothing anywhere links to it. */}
      <Route path="/kiosk" element={<Kiosk />} />
      {/* Catch-all: an unmatched path otherwise renders nothing (blank page). */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </>
  )
}
