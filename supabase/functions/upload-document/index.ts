// upload-document — privileged upload to the public `documents` bucket.
//
// Why this exists: the documents bucket's INSERT RLS policy gates on
// has_permission('edit_site'), which needs the request to be authenticated as
// the calling user. In practice the Storage API path does not honor the user's
// JWT the way PostgREST/GoTrue do, so direct browser uploads
// (supabase.storage.from('documents').upload(...)) are processed as anon and
// rejected by RLS — even for a full admin. We sidestep that here: verify the
// caller's permission with a caller-scoped client (which GoTrue *does* honor),
// then perform the write with the service-role key (bypassing Storage RLS).
//
// Mirrors the create-user / archive-file-url pattern: verify-then-act.
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

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return json({ error: 'Missing file' }, 400)
    }

    // Caller-scoped client — has_permission() runs against the caller's auth.uid()
    // via GoTrue, which (unlike the Storage API) reliably honors the user JWT.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: canEdit, error: permError } = await callerClient.rpc(
      'has_permission',
      { perm_key: 'edit_site' },
    )
    if (permError) {
      return json({ error: permError.message }, 400)
    }
    if (canEdit !== true) {
      return json({ error: 'Forbidden: edit_site permission required' }, 403)
    }

    // Derive a safe, unique object name. Keep the original extension so the
    // public URL serves the right content type.
    const ext = (file.name.split('.').pop() ?? 'pdf')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const path = `constitution-${Date.now()}.${ext || 'pdf'}`

    // Service-role client writes to the bucket, bypassing Storage RLS.
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { error: uploadError } = await adminClient.storage
      .from('documents')
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      })
    if (uploadError) {
      return json({ error: uploadError.message }, 400)
    }

    const { data } = adminClient.storage.from('documents').getPublicUrl(path)
    return json({ url: data.publicUrl, path }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
