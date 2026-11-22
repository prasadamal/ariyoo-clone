// Wayfare sign-up (Supabase Edge Function, Deno).
//
// Creates an account that is already confirmed, so nobody has to wait for an email that may never
// arrive (Supabase's built-in mailer is rate-limited). The app calls this, then signs in.
// Deploy: supabase functions deploy signup --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: 'Send JSON' });
  }
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const displayName = String(input.display_name ?? '').trim().replace(/\s+/g, ' ');
  const username = String(input.username ?? '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return json(400, { error: 'Enter a valid email address.' });
  if (password.length < 8 || password.length > 72) return json(400, { error: 'Password must be 8 to 72 characters.' });
  if (displayName.length < 2 || displayName.length > 60) return json(400, { error: 'Enter your name (2 to 60 characters).' });
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) return json(400, { error: 'Username: 3 to 24 letters, numbers, dots or underscores.' });

  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return json(409, { error: 'That username is taken. Try another.' });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return json(exists ? 409 : 400, { error: exists ? 'An account with this email already exists. Try signing in.' : error.message });
  }
  return json(200, { ok: true });
});
