// End-to-end API checks through PostgREST using the same query builder the app ships
// (@supabase/postgrest-js) and real HS256 JWTs. Run via supabase/tests/run_http.sh.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../../../apps/wayfare-mobile');
const require = createRequire(path.join(appDir, 'package.json'));
const { PostgrestClient } = require('@supabase/postgrest-js');

const BASE = process.env.WAYFARE_HTTP_URL;
const SECRET = process.env.WAYFARE_JWT_SECRET;
const DB = process.env.WAYFARE_HTTP_DB;

function jwt(claims) {
  const enc = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const asUser = id => new PostgrestClient(BASE, { headers: { Authorization: `Bearer ${jwt({ sub: id, role: 'authenticated' })}` } });
const asAnon = () => new PostgrestClient(BASE, { headers: { Authorization: `Bearer ${jwt({ role: 'anon' })}` } });

function sql(query) {
  return execFileSync('sudo', ['-u', 'postgres', 'psql', '-X', '-q', '-t', '-A', '-d', DB, '-c', query], { encoding: 'utf8' }).trim();
}

const ok = ({ data, error }) => {
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`);
  return data;
};

let alice;
let bob;
let tripId;

before(() => {
  alice = sql(`insert into auth.users (email, raw_user_meta_data) values ('alice@http.test', '{"display_name":"Alice","username":"alice_http"}') returning id`).split('\n')[0];
  bob = sql(`insert into auth.users (email, raw_user_meta_data) values ('bob@http.test', '{"display_name":"Bob"}') returning id`).split('\n')[0];
  tripId = crypto.randomUUID();
});

test('trip upsert as the owner (sync push path)', async () => {
  ok(
    await asUser(alice).from('trips').upsert({
      id: tripId,
      user_id: alice,
      title: 'Hampta Pass',
      trip_type: 'trek',
      place_key: 'hampta-pass',
      open_to_meet: true,
      starts_on: '2027-07-15',
      ends_on: '2027-07-19',
      currency: 'INR',
      updated_at: new Date().toISOString(),
    })
  );
  const { error } = await asUser(bob).from('trips').upsert({ id: crypto.randomUUID(), user_id: alice, title: 'forged', updated_at: new Date().toISOString() });
  assert.ok(error, 'cannot write rows for another user');
});

test('keyset (created_at, id) pagination returns every track point exactly once', async () => {
  const client = asUser(alice);
  const batch = (n, offset) =>
    Array.from({ length: n }, (_, i) => ({
      id: crypto.randomUUID(),
      trip_id: tripId,
      user_id: alice,
      recorded_at: new Date(Date.UTC(2027, 6, 15, 6) + (offset + i) * 60_000).toISOString(),
      latitude: 32.27 + (offset + i) * 0.0003,
      longitude: 77.36,
      altitude_m: 3000 + i,
      accuracy_m: 8,
    }));
  ok(await client.from('track_points').upsert(batch(300, 0)));
  ok(await client.from('track_points').upsert(batch(250, 300)));
  assert.equal(sql(`select count(distinct created_at) from public.track_points where trip_id = '${tripId}'`), '2', 'each batch shares one created_at');

  const PAGE = 100;
  const seen = new Set();
  let cursor = { at: '1970-01-01T00:00:00+00:00', id: '00000000-0000-0000-0000-000000000000' };
  for (let guard = 0; guard < 50; guard++) {
    const rows = ok(
      await client
        .from('track_points')
        .select('id, created_at')
        .eq('user_id', alice)
        .or(`created_at.gt."${cursor.at}",and(created_at.eq."${cursor.at}",id.gt.${cursor.id})`)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PAGE)
    );
    for (const r of rows) {
      assert.ok(!seen.has(r.id), 'no duplicates');
      seen.add(r.id);
    }
    if (rows.length) cursor = { at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id };
    if (rows.length < PAGE) break;
  }
  assert.equal(seen.size, 550);

  // The old timestamp-only cursor loses rows at a page boundary inside a batch.
  let naiveCursor = '1970-01-01T00:00:00+00:00';
  const naive = new Set();
  for (let guard = 0; guard < 50; guard++) {
    const rows = ok(
      await client.from('track_points').select('id, created_at').eq('user_id', alice).gt('created_at', naiveCursor).order('created_at').limit(PAGE)
    );
    rows.forEach(r => naive.add(r.id));
    if (rows.length) naiveCursor = rows[rows.length - 1].created_at;
    if (rows.length < PAGE) break;
  }
  assert.ok(naive.size < 550, `timestamp-only cursor saw ${naive.size}/550`);
});

test('RPCs resolve with the named arguments the app sends', async () => {
  const a = asUser(alice);
  const b = asUser(bob);
  assert.ok(Array.isArray(ok(await a.rpc('feed_page', { p_mode: 'discover', p_place_key: null, p_user: null, p_before: null, p_limit: 20, p_offset: 0 }))));
  const profile = ok(await b.rpc('get_profile', { p_user: alice, p_username: null }));
  assert.equal(profile[0].username, 'alice_http');
  assert.equal(profile[0].can_message, true);

  const conv = ok(await a.rpc('start_direct_conversation', { p_other: bob }));
  ok(await a.from('messages').insert({ id: crypto.randomUUID(), conversation_id: conv, sender_id: alice, kind: 'text', body: 'Hampta in July?' }).select('*').single());
  const inbox = ok(await b.rpc('my_conversations'));
  assert.equal(inbox[0].unread_count, 1);
  assert.equal(inbox[0].other_username, 'alice_http');
  const page = ok(await b.rpc('conversation_messages', { p_conversation: conv, p_before: null, p_limit: 40 }));
  assert.equal(page[0].body, 'Hampta in July?');

  const post = ok(
    await a
      .from('board_posts')
      .insert({ user_id: alice, kind: 'ride', title: 'Jeep Manali → Chika', place_name: 'Hampta Pass', place_key: 'hampta-pass', spots: 3 })
      .select('id')
      .single()
  );
  const single = ok(await b.rpc('board_page', { p_post: post.id }));
  assert.equal(single[0].title, 'Jeep Manali → Chika');

  const heading = ok(await b.rpc('travellers_heading_to', { p_place_key: 'hampta-pass', p_from: '2027-07-01', p_to: '2027-07-31', p_limit: 40 }));
  assert.equal(heading[0].user_id, alice);

  const nearby = await b.rpc('nearby_travellers', { p_lat: 32.24, p_lng: 77.19, p_radius_km: 25, p_limit: 60 });
  assert.match(nearby.error?.message ?? '', /Turn on nearby visibility/);
});

test('privileges and anon access behave like Supabase', async () => {
  const forged = await asUser(alice).from('profiles').update({ tier: 'legendary' }).eq('id', alice);
  assert.equal(forged.error?.code, '42501');
  ok(await asUser(alice).from('profiles').update({ bio: 'Mountains > beaches' }).eq('id', alice));

  const anon = asAnon();
  assert.equal(ok(await anon.rpc('username_available', { p_username: 'alice_http' })), false);
  const feed = await anon.rpc('feed_page', { p_mode: 'discover' });
  assert.equal(feed.error?.code, '42501');
  const rows = ok(await anon.from('profiles').select('id'));
  assert.equal(rows.length, 0);
});

test('remaining app query shapes (counts, upserts, column-scoped updates)', async () => {
  const a = asUser(alice);
  const b = asUser(bob);

  // Notification badge: HEAD + exact count.
  ok(await b.from('follows').insert({ follower_id: bob, followee_id: alice }));
  const head = await a.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', alice).is('read_at', null);
  assert.equal(head.error, null);
  assert.ok(head.count >= 1);
  ok(await a.rpc('mark_notifications_read'));
  const after = await a.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', alice).is('read_at', null);
  assert.equal(after.count, 0);

  // Nearby presence upsert (server coarsens) then reciprocal discovery.
  ok(await a.from('presence').upsert({ user_id: alice, lat_coarse: 32.2432, lng_coarse: 77.1892, place_label: 'Old Manali', expires_at: new Date(Date.now() + 4 * 3600_000).toISOString() }));
  ok(await b.from('presence').upsert({ user_id: bob, lat_coarse: 32.2399, lng_coarse: 77.1871, expires_at: new Date(Date.now() + 3600_000).toISOString() }));
  const near = ok(await b.rpc('nearby_travellers', { p_lat: 32.24, p_lng: 77.19, p_radius_km: 25, p_limit: 60 }));
  assert.equal(near[0].username, 'alice_http');

  // Mute only touches allowed columns.
  const conv = ok(await a.rpc('start_direct_conversation', { p_other: bob }));
  ok(await a.from('conversation_members').update({ muted: true }).eq('conversation_id', conv).eq('user_id', alice));
  const roleChange = await a.from('conversation_members').update({ role: 'owner' }).eq('conversation_id', conv).eq('user_id', alice);
  assert.equal(roleChange.error?.code, '42501');

  // Like / unlike with composite filters.
  const post = ok(await a.from('posts').insert({ user_id: alice, body: 'Balu ka Ghera at dawn' }).select('id').single());
  ok(await b.from('post_likes').insert({ post_id: post.id, user_id: bob }));
  ok(await b.from('post_likes').delete().eq('post_id', post.id).eq('user_id', bob));
  assert.equal(sql(`select like_count from public.posts where id = '${post.id}'`), '0');

  // Live share: insert returning, then the public viewer.
  const live = ok(
    await a
      .from('live_shares')
      .insert({ user_id: alice, label: 'Pass day', latitude: 32.29, longitude: 77.37, expires_at: new Date(Date.now() + 2 * 3600_000).toISOString() })
      .select('id, expires_at')
      .single()
  );
  const view = ok(await asAnon().rpc('get_live_share', { p_id: live.id }));
  assert.equal(view.active, true);
  // The app requires an acknowledged row before clearing its local live-link state.
  const forbiddenStop = await b.from('live_shares').update({ expires_at: new Date().toISOString() })
    .eq('id', live.id).select('id').maybeSingle();
  assert.equal(ok(forbiddenStop), null, 'outsider cannot acknowledge a revocation');
  assert.equal(ok(await asAnon().rpc('get_live_share', { p_id: live.id })).active, true);
  const revoked = ok(await a.from('live_shares').update({ expires_at: new Date().toISOString() })
    .eq('id', live.id).select('id').maybeSingle());
  assert.equal(revoked.id, live.id, 'owner receives acknowledgement');
  const ended = ok(await asAnon().rpc('get_live_share', { p_id: live.id }));
  assert.equal(ended.active, false);
  assert.equal(ended.latitude, null, 'revoked link hides precise coordinates');

  // Block list stays visible to the blocker only.
  ok(await a.from('blocks').insert({ blocker_id: alice, blocked_id: bob }));
  assert.equal(ok(await a.rpc('my_blocked_profiles'))[0].id, bob);
  assert.equal(ok(await b.rpc('my_blocked_profiles')).length, 0);
  const dm = await b.rpc('start_direct_conversation', { p_other: alice });
  assert.match(dm.error?.message ?? '', /cannot message/);
});
