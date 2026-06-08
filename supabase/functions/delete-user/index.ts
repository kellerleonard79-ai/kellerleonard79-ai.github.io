// delete-user — privileged member deletion.
//
// Removes a user from auth.users using the service-role key (which cascades the
// profiles row via the FK). Protected: the caller must be authenticated AND
// pass the public.is_admin() check evaluated against their own JWT, so only
// SCI/Admin members can invoke it.
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

    const { user_id } = await req.json().catch(() => ({}))
    if (!user_id) {
      return json({ error: 'Missing user_id' }, 400)
    }

    // Service-role client — performs the privileged auth.users deletion.
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(user_id)
    if (deleteError) {
      return json({ error: deleteError.message }, 400)
    }

    return json({ success: true }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
