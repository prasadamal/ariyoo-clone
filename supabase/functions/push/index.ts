// Wayfare push sender (Supabase Edge Function, Deno).
//
// Wire two Database Webhooks (Dashboard → Database → Webhooks), both POSTing here on INSERT
// with the header `x-wayfare-secret: <PUSH_WEBHOOK_SECRET>`:
//   • public.notifications  → follows, likes, comments, board requests, trip matches…
//   • public.messages       → direct + crew chat messages (destination rooms stay quiet)
//
// Deploy: supabase functions deploy push --no-verify-jwt
//         supabase secrets set PUSH_WEBHOOK_SECRET=<long random string>
import { createClient } from 'jsr:@supabase/supabase-js@2';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { url: string };
  channelId?: string;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function displayName(p: { display_name?: string | null; username?: string | null } | null) {
  return p?.display_name || (p?.username ? `@${p.username}` : 'A traveller');
}

function clip(text: string, max = 140) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function profileOf(id: string | null | undefined) {
  if (!id) return null;
  const { data } = await admin.from('profiles').select('display_name, username').eq('id', id).maybeSingle();
  return data;
}

async function tokensFor(userIds: string[]) {
  if (!userIds.length) return [];
  const { data } = await admin.from('push_tokens').select('token, user_id').in('user_id', userIds);
  return data ?? [];
}

async function sendExpo(messages: ExpoMessage[]) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
    // Drop tokens Expo reports as unregistered (app uninstalled / token rotated).
    const dead = (json.data ?? [])
      .map((ticket, idx) => (ticket.details?.error === 'DeviceNotRegistered' ? chunk[idx].to : null))
      .filter((t): t is string => Boolean(t));
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
  }
}

async function forNotification(n: Record<string, unknown>): Promise<ExpoMessage[]> {
  const actor = await profileOf(n.actor_id as string | null);
  const who = displayName(actor);
  const body = (n.body as string | null) ?? '';
  const entity = n.entity_id as string | null;
  let title = 'Wayfare';
  let text = '';
  let url = '/(tabs)/inbox';
  switch (n.kind) {
    case 'follow':
      title = 'New follower';
      text = `${who} started following your journeys`;
      url = `/user/${n.actor_id}`;
      break;
    case 'like':
      title = 'Your post is loved';
      text = `${who} liked your post`;
      url = `/post/${entity}`;
      break;
    case 'comment':
      title = `${who} commented`;
      text = clip(body || 'New comment on your post');
      url = `/post/${entity}`;
      break;
    case 'board_request':
      title = 'Someone wants to join';
      text = `${who} asked to join “${clip(body, 60)}”`;
      url = `/board/${entity}`;
      break;
    case 'board_accepted':
      title = 'You are in! 🎒';
      text = `${who} accepted you for “${clip(body, 60)}”. Say hi in the crew chat.`;
      url = `/board/${entity}`;
      break;
    case 'board_declined':
      title = 'Board update';
      text = `“${clip(body, 60)}” is full this time — keep exploring.`;
      url = `/board/${entity}`;
      break;
    case 'trip_match':
      title = 'Travellers on your dates ✨';
      text = `${who} is also heading to ${body || 'your destination'} around your dates`;
      url = `/trip/${entity}?tab=crew`;
      break;
    case 'tip_upvote':
      title = 'Your tip helped someone';
      text = `${who} found your ${body || 'travel'} tip useful`;
      break;
    case 'crew_join':
      title = 'Crew update';
      text = `${who} joined ${body || 'your crew'}`;
      url = `/chat/${entity}`;
      break;
    default:
      text = clip(body || 'You have a new update');
  }
  const tokens = await tokensFor([n.user_id as string]);
  return tokens.map(t => ({ to: t.token, title, body: text, sound: 'default', data: { url }, channelId: 'social' }));
}

async function forMessage(m: Record<string, unknown>): Promise<ExpoMessage[]> {
  if (m.kind === 'system') return [];
  const conversationId = m.conversation_id as string;
  const { data: conv } = await admin.from('conversations').select('kind, title').eq('id', conversationId).maybeSingle();
  if (!conv || conv.kind === 'place') return [];
  const { data: members } = await admin
    .from('conversation_members')
    .select('user_id, muted')
    .eq('conversation_id', conversationId);
  const recipients = (members ?? []).filter(x => x.user_id !== m.sender_id && !x.muted).map(x => x.user_id as string);
  if (!recipients.length) return [];
  const sender = displayName(await profileOf(m.sender_id as string));
  const preview =
    m.kind === 'image' ? '📷 Photo' : m.kind === 'location' ? '📍 Shared a location' : clip(String(m.body ?? ''));
  const title = conv.kind === 'direct' ? sender : conv.title || 'Crew chat';
  const body = conv.kind === 'direct' ? preview : `${sender}: ${preview}`;
  const tokens = await tokensFor(recipients);
  return tokens.map(t => ({
    to: t.token,
    title,
    body,
    sound: 'default',
    data: { url: `/chat/${conversationId}` },
    channelId: 'messages',
  }));
}

Deno.serve(async req => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-wayfare-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (payload.type !== 'INSERT' || !payload.record) return new Response('ignored');

  const messages =
    payload.table === 'notifications'
      ? await forNotification(payload.record)
      : payload.table === 'messages'
        ? await forMessage(payload.record)
        : [];
  if (messages.length) await sendExpo(messages);
  return new Response(JSON.stringify({ sent: messages.length }), { headers: { 'Content-Type': 'application/json' } });
});
