// agenda-file-url — mint a short-lived signed URL for an agenda attachment file.
//
// The raw storage path is never exposed to the client. Given an attachment id,
// this function reads the row through a caller-scoped client so the
// agenda_item_attachments SELECT RLS policy enforces tier visibility against the
// caller's own JWT. Only if the row is visible does it use the service-role key
// to sign the private object in the `agenda-files` bucket.
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

// Signed URLs are valid for 60 seconds — long enough to open, short enough to
// not be a durable share link.
const SIGNED_URL_TTL = 60

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

    const { attachment_id } = await req.json().catch(() => ({}))
    if (!attachment_id) {
      return json({ error: 'Missing attachment_id' }, 400)
    }

    // Caller-scoped client — the agenda_item_attachments SELECT RLS policy gates
    // this read by the caller's role.order, so an out-of-tier row returns nothing.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: att, error: readError } = await callerClient
      .from('agenda_item_attachments')
      .select('kind, file_url')
      .eq('id', attachment_id)
      .maybeSingle()

    if (readError) {
      return json({ error: readError.message }, 400)
    }
    if (!att) {
      // No row visible: either it doesn't exist or the caller's tier is too low.
      return json({ error: 'Not found or access denied' }, 404)
    }
    if (att.kind !== 'file' || !att.file_url) {
      return json({ error: 'This attachment has no stored file' }, 400)
    }

    // Service-role client signs the private object.
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: signed, error: signError } = await adminClient.storage
      .from('agenda-files')
      .createSignedUrl(att.file_url, SIGNED_URL_TTL)

    if (signError || !signed) {
      return json({ error: signError?.message ?? 'Could not sign file' }, 400)
    }

    return json({ url: signed.signedUrl }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
