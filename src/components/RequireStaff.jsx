import RequirePermission from './RequirePermission.jsx'

// Gates a route to officers/admins — anyone who can run meetings. Thin wrapper
// around RequirePermission so the existing officer pages keep working while all
// gating logic lives in one place.
export default function RequireStaff({ children }) {
  return <RequirePermission permission="create_meetings">{children}</RequirePermission>
}
