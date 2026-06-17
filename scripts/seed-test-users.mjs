// seed-test-users.mjs — bulk-create test accounts at each permission tier.
//
// Why this exists: every real account needs a matching profiles row, the right
// role_id, status='active', and the legacy clearance_level synced. The
// `create-user` Edge Function already does all of that correctly (and rolls
// back on failure), so this script just signs in as an existing admin to get a
// JWT, then calls that function in a loop — no service-role key needed.
//
// Emails are synthetic (@phs.local). create-user confirms them automatically,
// so no inbox is required — you log in with the STUDENT ID, never the email.
//
// Usage:
//   ADMIN_STUDENT_ID=<your admin student id> ADMIN_PASSWORD=<pw> \
//     node scripts/seed-test-users.mjs
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- minimal .env loader (avoids adding a dotenv dependency) ---
function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* .env optional if vars already exported */ }
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const ADMIN_STUDENT_ID = process.env.ADMIN_STUDENT_ID
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test1234'

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env).')
  process.exit(1)
}
if (!ADMIN_STUDENT_ID || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_STUDENT_ID and ADMIN_PASSWORD env vars (an existing admin login).')
  process.exit(1)
}

// How many of each tier to create. Tweak freely. Tier names are matched against
// the `roles` table case-insensitively, so they must exist there.
const PLAN = [
  { role: 'General Member', count: 4, prefix: 'member' },
  { role: 'Class Officer', count: 3, prefix: 'class' },
  { role: 'Executive Officer', count: 2, prefix: 'exec' },
  { role: 'SCI / Admin', count: 1, prefix: 'admin' },
]

const GRADES = ['9', '10', '11', '12']

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function main() {
  // 1. Resolve the admin's email (login is by student id) and sign in for a JWT.
  const { data: email, error: lookupErr } = await supabase.rpc(
    'email_for_student_id', { p_student_id: ADMIN_STUDENT_ID.trim() },
  )
  if (lookupErr || !email) throw new Error(`No account for student id ${ADMIN_STUDENT_ID}`)

  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: ADMIN_PASSWORD })
  if (signInErr) throw new Error(`Admin sign-in failed: ${signInErr.message}`)
  console.log(`Signed in as admin (${ADMIN_STUDENT_ID}).`)

  // 2. Map tier names -> role_id from the live roles table.
  const { data: roles, error: rolesErr } = await supabase
    .from('roles').select('id, name')
  if (rolesErr) throw new Error(`Could not read roles: ${rolesErr.message}`)
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]))

  // 3. Loop the plan, calling create-user for each test account.
  let made = 0
  const created = []
  for (const tier of PLAN) {
    const roleId = roleByName.get(tier.role.toLowerCase())
    if (!roleId) {
      console.warn(`! Skipping "${tier.role}" — no matching row in roles table. Available: ${roles.map((r) => r.name).join(', ')}`)
      continue
    }
    for (let i = 1; i <= tier.count; i++) {
      const studentId = `test-${tier.prefix}-${i}`
      const payload = {
        email: `test-${tier.prefix}-${i}@phs.local`,
        password: TEST_PASSWORD,
        full_name: `Test ${tier.prefix[0].toUpperCase()}${tier.prefix.slice(1)} ${i}`,
        student_id: studentId,
        grade_level: GRADES[(i - 1) % GRADES.length],
        shirt_size: 'M',
        role_id: roleId,
      }
      const { data, error } = await supabase.functions.invoke('create-user', { body: payload })
      if (error || data?.error) {
        console.warn(`  ✗ ${studentId} — ${error?.message || data?.error}`)
      } else {
        created.push(studentId)
        made++
        console.log(`  ✓ ${studentId} (${tier.role})`)
      }
    }
  }

  console.log(`\nDone. Created ${made} test account(s). Log in with the Student ID and password "${TEST_PASSWORD}".`)
  if (created.length) console.log(`Student IDs: ${created.join(', ')}`)
  console.log('To remove later: delete the accounts whose student_id starts with "test-".')
}

main().catch((e) => { console.error('\nFailed:', e.message); process.exit(1) })
