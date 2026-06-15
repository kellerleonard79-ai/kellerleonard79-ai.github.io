// create-user — privileged member account creation.
//
// Lets an SCI/Admin create a fully-formed, already-approved member account on
// someone's behalf (rather than waiting for them to self-register via Join SGA).
// Uses the service-role key to create the auth.users record with a confirmed
// email, then promotes the auto-created profile to `active` with the chosen
// role. Protected: the caller must be authenticated AND pass public.is_admin().
//
// Reserved secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
// are injected automatically by the Edge Functions runtime.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Mirrors clearanceForRole on the client so the legacy clearance_level column
// stays in sync with the assigned role.
function clearanceForRole(role: {
  is_admin?: boolean
  permissions?: Record<string, boolean>
} | null) {
  if (!role) return 'member'
  if (role.is_admin) return 'admin'
  if (role.permissions?.create_meetings) return 'officer'
  return 'member'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client scoped to the caller's JWT — is_admin() runs against their auth.uid().
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: isAdmin, error: adminError } =
      await callerClient.rpc('is_admin')
    if (adminError) {
      return json({ error: adminError.message }, 400)
    }
    if (!isAdmin) {
      return json({ error: 'Forbidden: admin access required' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const studentId = String(body.student_id ?? '').trim()
    const gradeLevel = String(body.grade_level ?? '').trim()
    const shirtSize = String(body.shirt_size ?? '').trim()
    const roleId = body.role_id ? String(body.role_id) : null

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400)
    }

    // Service-role client — performs the privileged auth.users creation and the
    // follow-up profile update (both bypass RLS).
    const adminClient = createClient(supabaseUrl, serviceKey)

    // Create the auth user with a pre-confirmed email so the account is usable
    // immediately. handle_new_user() fires on insert and seeds the profile row
    // from this metadata.
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          student_id: studentId,
          grade_level: gradeLevel,
          shirt_size: shirtSize,
        },
      })
    if (createError) {
      return json({ error: createError.message }, 400)
    }

    const userId = created.user?.id
    if (!userId) {
      return json({ error: 'User creation returned no id' }, 500)
    }

    // Resolve the chosen role (for clearance_level) and promote the freshly
    // seeded profile from the default 'pending' member to an active account.
    let role = null
    if (roleId) {
      const { data: r } = await adminClient
        .from('roles')
        .select('id, is_admin, permissions')
        .eq('id', roleId)
        .single()
      role = r ?? null
    }

    const update: Record<string, unknown> = {
      status: 'active',
      clearance_level: clearanceForRole(role),
    }
    if (roleId) update.role_id = roleId

    const { error: updateError } = await adminClient
      .from('profiles')
      .update(update)
      .eq('id', userId)
    if (updateError) {
      // Roll back the half-created account so a failed promotion doesn't leave
      // an orphaned pending login.
      await adminClient.auth.admin.deleteUser(userId)
      return json({ error: updateError.message }, 400)
    }

    return json({ success: true, user_id: userId }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
