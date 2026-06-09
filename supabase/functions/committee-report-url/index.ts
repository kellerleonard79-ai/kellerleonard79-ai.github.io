// committee-report-url — mint a short-lived signed URL for a report file.
//
// The raw storage path is never exposed to the client. Given a report id, this
// function reads the row through a caller-scoped client so the committee_reports
// SELECT RLS policy enforces access against the caller's own JWT. Only if the
// row is visible does it use the service-role key to sign the private object,
// returning the temporary URL.
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

    const { report_id } = await req.json().catch(() => ({}))
    if (!report_id) {
      return json({ error: 'Missing report_id' }, 400)
    }

    // Caller-scoped client — the committee_reports SELECT RLS policy gates this
    // read, so an inaccessible report simply returns no row.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: report, error: readError } = await callerClient
      .from('committee_reports')
      .select('file_url')
      .eq('id', report_id)
      .maybeSingle()

    if (readError) {
      return json({ error: readError.message }, 400)
    }
    if (!report) {
      // No row visible: either it doesn't exist or the caller can't read it.
      return json({ error: 'Not found or access denied' }, 404)
    }
    if (!report.file_url) {
      return json({ error: 'This report has no stored file' }, 400)
    }

    // Service-role client signs the private object.
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: signed, error: signError } = await adminClient.storage
      .from('committee-reports')
      .createSignedUrl(report.file_url, SIGNED_URL_TTL)

    if (signError || !signed) {
      return json({ error: signError?.message ?? 'Could not sign file' }, 400)
    }

    return json({ url: signed.signedUrl }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
