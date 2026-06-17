// The fixed permission set, in the order the plan lists them. Single source of
// truth shared by the tiers editor, the per-member override editor, and any
// gating — so the three never drift apart.
export const PERMISSION_KEYS = [
  ['view_directory', 'View directory'],
  ['edit_directory', 'Edit directory'],
  ['view_meetings', 'View meetings'],
  ['create_meetings', 'Create meetings'],
  ['edit_agendas', 'Edit agendas'],
  ['view_bookkeeping', 'View bookkeeping'],
  ['manage_bookkeeping', 'Manage bookkeeping'],
  ['view_archives', 'View archives'],
  ['upload_archives', 'Upload archives'],
  ['view_elections', 'View elections'],
  ['manage_elections', 'Manage elections'],
  ['edit_site', 'Edit site'],
  ['manage_roles', 'Manage roles'],
  ['manage_committees', 'Manage committees'],
]

// Resolve a member's effective permission for one key. Mirrors the SQL
// has_permission() and AuthContext.hasPermission exactly:
//   1. Admin tier always passes (overrides cannot lock it out).
//   2. A per-member override wins over the role default.
//   3. Otherwise fall back to the role's permissions jsonb.
export function effectivePermission(role, overrides, key) {
  if (role?.is_admin) return true
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key))
    return overrides[key] === true
  return role?.permissions?.[key] === true
}

// Tri-state of a single override key for UI controls: 'default' (no override,
// inherits the role), 'grant' (forced on), or 'revoke' (forced off).
export function overrideState(overrides, key) {
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, key))
    return 'default'
  return overrides[key] === true ? 'grant' : 'revoke'
}
