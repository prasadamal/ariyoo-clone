// Permanently deletes the calling user's account: storage files first, then the
// auth user (which cascades to profiles -> trips -> entries/expenses/...).
//
// Deploy:  supabase functions deploy delete-account
// Called by the app with the signed-in user's JWT (verify_jwt stays ON).
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'entry-media';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Admin = ReturnType<typeof createClient>;

/** Collect every object path under `prefix` (folders are entries without an id). */
async function collectPaths(admin: Admin, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const full = `${prefix}/${item.name}`;
      if (item.id) paths.push(full);
      else paths.push(...(await collectPaths(admin, full, depth + 1)));
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing authorization' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);
  const userId = userData.user.id;

  try {
    const paths = await collectPaths(admin, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ ok: true, removedFiles: paths.length });
  } catch (e) {
    console.error('delete-account failed', userId, e);
    return json({ error: 'Could not delete account. Please try again or contact support.' }, 500);
  }
});
