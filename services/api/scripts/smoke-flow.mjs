// End-to-end check against a running API and a real database:
//   API_URL=http://localhost:3333 node scripts/smoke-flow.mjs
// Creates its own accounts and deletes them again, so it is safe to run repeatedly. Never run it
// against production with ADMIN_API_KEY set unless you mean to (it suspends only its own accounts).
import assert from 'node:assert/strict';

const base = process.env.API_URL || process.env.API_BASE || 'http://localhost:3333';
const adminKey = process.env.ADMIN_API_KEY || '';
const password = 'smoke-flow-password-123';
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json };
}

async function register(label, extra = {}) {
  const res = await call('POST', '/auth/register', {
    body: { email: `smoke-${label}-${stamp}@example.com`, password, flname: `Smoke ${label}`, isSeeker: true, isSolver: false, acceptedTerms: true, ...extra },
  });
  assert.equal(res.status, 200, `register ${label}: ${JSON.stringify(res.json)}`);
  return res.json;
}

async function main() {
  assert.equal((await call('GET', '/health')).status, 200);
  assert.equal((await call('GET', '/ready')).status, 200);

  // Terms must be accepted; weak passwords are refused.
  const noTerms = await call('POST', '/auth/register', { body: { email: `x-${stamp}@example.com`, password, flname: 'X' } });
  assert.equal(noTerms.status, 400); assert.equal(noTerms.json.code, 'TERMS_REQUIRED');
  assert.equal((await call('POST', '/auth/register', { body: { email: `y-${stamp}@example.com`, password: 'short', flname: 'Y', acceptedTerms: true } })).status, 400);

  const topic = `smoketopic${stamp.replace(/\D/g, '').slice(-10)}`;
  const seeker = await register('seeker');
  const expert = await register('expert', { isSolver: true });
  const other = await register('other', { isSolver: true });
  const outsider = await register('outsider');
  assert.equal(expert.isSolver, true);
  assert.equal(seeker.isSolver, false);

  // Login returns the same shape; /me agrees.
  const login = await call('POST', '/auth/login', { body: { email: seeker.email, password } });
  assert.equal(login.status, 200); assert.equal(login.json.userId, seeker.userId);
  assert.equal((await call('GET', '/api/user/me', { token: seeker.token })).json.email, seeker.email);

  // Topics: only your own, whatever userId the body claims.
  const add = await call('POST', '/api/Tags/addUserTags', { token: expert.token, body: [{ tagName: topic, userId: seeker.userId }] });
  assert.equal(add.status, 200);
  assert.equal((await call('GET', `/api/Tags/getUserTags/${seeker.userId}`, { token: seeker.token })).json.length, 0);
  const expertTags = (await call('GET', `/api/Tags/getUserTags/${expert.userId}`, { token: expert.token })).json;
  assert.equal(expertTags.length, 1);
  assert.equal((await call('GET', `/api/Tags/getUserTags/${expert.userId}`)).status, 401);
  // Someone else cannot remove them.
  await call('DELETE', `/api/Tags/deleteUserTag/${expert.userId}/${expertTags[0].tagId}`, { token: seeker.token });
  assert.equal((await call('GET', `/api/Tags/getUserTags/${expert.userId}`, { token: expert.token })).json.length, 1);

  // A question on the expert's topic goes straight to that expert.
  const asked = await call('POST', '/api/Message/postQuestion', { token: seeker.token, body: { message: `Smoke: where to eat? #${topic}`, tag: [{ tagName: topic }] } });
  assert.equal(asked.status, 200); assert.equal(asked.json.matched, true);
  const sid = asked.json.sessionId;
  const expertChats = (await call('GET', `/api/Message/getallsessionssolver/${expert.userId}`, { token: expert.token })).json;
  assert.ok(expertChats.some(s => s.sessionId === sid && s.peerName === 'Smoke seeker'));
  assert.equal((await call('GET', `/api/Message/getallsessionssolver/${expert.userId}`, { token: seeker.token })).status, 403);

  const reply = await call('POST', '/api/Message/postMessage', { token: expert.token, body: { messageText: 'Smoke reply', sessionId: sid } });
  assert.equal(reply.status, 200);
  assert.equal((await call('GET', `/api/Message/getMessagesBySessionId/${sid}`, { token: seeker.token })).json.length, 2);
  // Outsiders can neither read nor write.
  assert.equal((await call('GET', `/api/Message/getMessagesBySessionId/${sid}`, { token: outsider.token })).status, 403);
  assert.equal((await call('POST', '/api/Message/postMessage', { token: outsider.token, body: { messageText: 'hi', sessionId: sid } })).status, 403);
  assert.equal((await call('GET', `/api/Message/session/${sid}`, { token: outsider.token })).status, 403);
  const detail = (await call('GET', `/api/Message/session/${sid}`, { token: seeker.token })).json;
  assert.equal(detail.peer.userId, expert.userId); assert.equal(detail.blocked, false);

  // Abusive text is refused.
  const abusive = await call('POST', '/api/Message/postMessage', { token: seeker.token, body: { messageText: 'kill yourself', sessionId: sid } });
  assert.equal(abusive.status, 422); assert.equal(abusive.json.code, 'CONTENT_BLOCKED');

  // A question nobody matches waits in the open queue; askers never see or claim their own.
  const open = await call('POST', '/api/Message/postQuestion', { token: seeker.token, body: { message: `Smoke open question ${stamp}` } });
  assert.equal(open.json.matched, false);
  const openId = open.json.sessionId;
  assert.ok((await call('GET', '/api/Message/openQuestions', { token: other.token })).json.some(q => q.sessionId === openId));
  assert.deepEqual((await call('GET', '/api/Message/openQuestions', { token: outsider.token })).json, []);
  assert.equal((await call('POST', `/api/Message/claim/${openId}`, { token: outsider.token })).status, 403);
  assert.equal((await call('POST', `/api/Message/claim/${openId}`, { token: seeker.token })).status, 403);
  // Two experts race for it: exactly one wins.
  const race = await Promise.all([expert, other].map(u => call('POST', `/api/Message/claim/${openId}`, { token: u.token })));
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
  assert.ok(!(await call('GET', '/api/Message/openQuestions', { token: other.token })).json.some(q => q.sessionId === openId));


  // Report + block: only people you have talked to; the chat closes both ways and leaves both lists.
  assert.equal((await call('POST', '/api/safety/block', { token: seeker.token, body: { userId: outsider.userId } })).status, 404);
  assert.equal((await call('POST', '/api/safety/report', { token: seeker.token, body: { userId: expert.userId, reason: 'nonsense' } })).status, 400);
  const report = await call('POST', '/api/safety/report', { token: seeker.token, body: { userId: expert.userId, sessionId: sid, reason: 'harassment', details: 'smoke test' } });
  assert.equal(report.status, 201); assert.equal(report.json.blocked, true);
  for (const u of [seeker, expert]) {
    const sent = await call('POST', '/api/Message/postMessage', { token: u.token, body: { messageText: 'after block', sessionId: sid } });
    assert.equal(sent.status, 403); assert.equal(sent.json.code, 'CHAT_CLOSED');
  }
  assert.ok(!(await call('GET', `/api/Message/getallsessionsseeker/${seeker.userId}`, { token: seeker.token })).json.some(s => s.sessionId === sid));
  assert.ok(!(await call('GET', `/api/Message/getallsessionssolver/${expert.userId}`, { token: expert.token })).json.some(s => s.sessionId === sid));
  assert.equal((await call('GET', '/api/safety/blocks', { token: seeker.token })).json.length, 1);
  // A blocked expert is not matched to this asker again.
  const again = await call('POST', '/api/Message/postQuestion', { token: seeker.token, body: { message: `Smoke again #${topic}`, tag: [{ tagName: topic }] } });
  assert.equal(again.json.matched, false);
  assert.ok(!(await call('GET', '/api/Message/openQuestions', { token: expert.token })).json.some(q => q.sessionId === again.json.sessionId));
  assert.equal((await call('DELETE', `/api/safety/block/${expert.userId}`, { token: seeker.token })).status, 200);

  // Profile validation, password change.
  assert.equal((await call('PUT', '/api/user', { token: seeker.token, body: { userName: 'a b' } })).status, 400);
  assert.equal((await call('PUT', '/api/user', { token: seeker.token, body: { userName: `smoke_${stamp.replace(/\D/g, '').slice(-8)}`, isSolver: true } })).json.isSolver, true);
  assert.equal((await call('PUT', '/api/user/updatepassword', { token: seeker.token, body: { oldPassword: password, newPassword: 'short' } })).status, 400);
  assert.equal((await call('PUT', '/api/user/updatepassword', { token: seeker.token, body: { oldPassword: 'wrong', newPassword: 'another-long-password-1' } })).status, 401);

  // Push tokens: validated, and they follow the last account to register them.
  const pushToken = `ExponentPushToken[smoke${stamp.replace(/\D/g, '')}]`;
  assert.equal((await call('POST', '/api/user/pushToken', { token: seeker.token, body: { token: 'nope' } })).status, 400);
  assert.equal((await call('POST', '/api/user/pushToken', { token: seeker.token, body: { token: pushToken, platform: 'android' } })).status, 200);
  assert.equal((await call('POST', '/api/user/pushToken', { token: outsider.token, body: { token: pushToken, platform: 'ios' } })).status, 200);
  assert.equal((await call('DELETE', '/api/user/pushToken', { token: outsider.token, body: { token: pushToken } })).status, 200);

  // Moderation (only when a key is configured for this run).
  if (adminKey) {
    const admin = { 'x-admin-key': adminKey };
    assert.equal((await call('GET', '/admin/reports', { headers: { 'x-admin-key': 'wrong' } })).status, 401);
    const queue = (await call('GET', '/admin/reports', { headers: admin })).json;
    const mine = queue.find(r => r.id === report.json.reportId);
    assert.ok(mine); assert.equal(mine.reported.email, expert.email);
    assert.ok(mine.messages.some(m => m.messageText === 'Smoke reply'));
    assert.equal((await call('POST', `/admin/users/${expert.userId}/suspend`, { headers: admin, body: { suspended: true } })).status, 200);
    assert.equal((await call('GET', '/api/user/me', { token: expert.token })).status, 401);
    const blockedLogin = await call('POST', '/auth/login', { body: { email: expert.email, password } });
    assert.equal(blockedLogin.status, 403); assert.equal(blockedLogin.json.code, 'ACCOUNT_SUSPENDED');
    assert.equal((await call('POST', `/admin/users/${expert.userId}/suspend`, { headers: admin, body: { suspended: false } })).status, 200);
    assert.equal((await call('POST', `/admin/reports/${mine.id}`, { headers: admin, body: { status: 'resolved' } })).status, 200);
    assert.equal((await call('GET', `/admin/users?email=${encodeURIComponent(expert.email)}`, { headers: admin })).json.id, expert.userId);
  } else {
    // Without a key in this run: 503 when the server has none configured, 401 when it has one (a real deployment).
    assert.ok([401, 503].includes((await call('GET', '/admin/reports')).status));
  }

  // Photos: only JPEG/PNG/WebP bytes, readable by the two participants only.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const upload = async (bytes, token) => {
    const form = new FormData();
    form.append('sessionId', String(openId));
    form.append('image', new Blob([bytes], { type: 'image/png' }), 'photo.png');
    const res = await fetch(`${base}/api/Message/uploadImage`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  assert.equal((await upload(Buffer.from('<svg onload=alert(1)>'), seeker.token)).status, 415);
  const photo = await upload(png, seeker.token);
  assert.equal(photo.status, 200);
  const photoUrl = photo.json.imageUrl;
  const claimer = race[0].status === 200 ? expert : other;
  assert.equal((await call('GET', photoUrl, { token: seeker.token })).status, 200);
  assert.equal((await call('GET', photoUrl, { token: claimer.token })).status, 200);
  assert.equal((await call('GET', photoUrl, { token: outsider.token })).status, 404);
  assert.equal((await call('GET', photoUrl)).status, 401);

  // The asker closes the claimed question and thanks the expert; only the asker can, and only once.
  await call('POST', '/api/Message/postMessage', { token: claimer.token, body: { messageText: 'Try the beach shacks', sessionId: openId } });
  assert.equal((await call('POST', `/api/Message/resolve/${openId}`, { token: claimer.token, body: { helpful: true } })).status, 404);
  const resolved = await call('POST', `/api/Message/resolve/${openId}`, { token: seeker.token, body: { helpful: true } });
  assert.equal(resolved.status, 200); assert.equal(resolved.json.helpful, true);
  assert.equal((await call('POST', `/api/Message/resolve/${openId}`, { token: seeker.token, body: { helpful: false } })).json.code, 'ALREADY_RESOLVED');
  const afterResolve = await call('POST', '/api/Message/postMessage', { token: claimer.token, body: { messageText: 'one more thing', sessionId: openId } });
  assert.equal(afterResolve.json.code, 'CHAT_CLOSED');
  const closedInfo = (await call('GET', `/api/Message/session/${openId}`, { token: seeker.token })).json;
  assert.equal(closedInfo.resolved, true); assert.deepEqual(closedInfo.peerStats, { answered: 1, helpful: 1 });
  assert.deepEqual((await call('GET', '/api/user/stats', { token: claimer.token })).json, { asked: 0, answered: 1, helpful: 1 });
  // A question nobody picked up can be withdrawn; there is nobody to thank.
  const lonely = await call('POST', '/api/Message/postQuestion', { token: seeker.token, body: { message: `Smoke withdrawn ${stamp}` } });
  const withdrawn = await call('POST', `/api/Message/resolve/${lonely.json.sessionId}`, { token: seeker.token, body: { helpful: true } });
  assert.equal(withdrawn.json.helpful, null);
  assert.ok(!(await call('GET', '/api/Message/openQuestions', { token: other.token })).json.some(q => q.sessionId === lonely.json.sessionId));

  // Personal answer library: search your own conversations (any case), save answers; private to each member.
  const found = await call('GET', `/api/library/search?q=${encodeURIComponent('BEACH shacks')}`, { token: seeker.token });
  assert.equal(found.status, 200);
  const hit = found.json.messages.find(m => m.sessionId === openId);
  assert.ok(hit && hit.fromMe === false && hit.saved === false && hit.snippet.includes('beach shacks'), 'search finds the answer');
  const byTitle = (await call('GET', '/api/library/search?q=open%20question', { token: seeker.token })).json;
  assert.ok(byTitle.questions.some(q => q.sessionId === openId));
  // The opening message only repeats a question that is already listed, so it is not shown twice.
  assert.ok(!byTitle.messages.some(m => m.sessionId === openId), 'question not repeated as a message');
  assert.deepEqual((await call('GET', '/api/library/search?q=beach%20shacks', { token: outsider.token })).json.messages, []);
  for (const q of ['', 'a', '%25', '%25%25', '_']) assert.equal((await call('GET', `/api/library/search?q=${q}`, { token: seeker.token })).status, 400, `query ${q}`);
  assert.equal((await call('GET', '/api/library/search?q=beach')).status, 401);
  assert.equal((await call('PUT', `/api/library/saved/${hit.messageId}`, { token: outsider.token })).status, 404);
  assert.equal((await call('PUT', '/api/library/saved/abc', { token: seeker.token })).status, 400);
  for (let i = 0; i < 2; i++) assert.deepEqual((await call('PUT', `/api/library/saved/${hit.messageId}`, { token: seeker.token })).json, { messageId: hit.messageId, saved: true });
  const savedList = (await call('GET', '/api/library/saved', { token: seeker.token })).json.saved;
  assert.equal(savedList.length, 1); assert.equal(savedList[0].text, 'Try the beach shacks'); assert.equal(savedList[0].sessionId, openId);
  assert.equal((await call('GET', `/api/library/search?q=beach%20shacks`, { token: seeker.token })).json.messages.find(m => m.messageId === hit.messageId).saved, true);
  assert.deepEqual((await call('GET', '/api/library/saved', { token: outsider.token })).json.saved, []);
  // The expert can keep their own answer too, independently.
  assert.equal((await call('PUT', `/api/library/saved/${hit.messageId}`, { token: claimer.token })).status, 200);
  assert.deepEqual((await call('DELETE', `/api/library/saved/${hit.messageId}`, { token: seeker.token })).json, { messageId: hit.messageId, saved: false });
  assert.equal((await call('DELETE', `/api/library/saved/${hit.messageId}`, { token: seeker.token })).status, 200);
  assert.deepEqual((await call('GET', '/api/library/saved', { token: seeker.token })).json.saved, []);
  assert.equal((await call('GET', '/api/library/saved', { token: claimer.token })).json.saved.length, 1);

  // Account deletion: needs the password, removes the conversations for both sides, kills the token.
  assert.equal((await call('DELETE', '/api/user', { token: seeker.token, body: { password: 'wrong' } })).status, 401);
  assert.equal((await call('DELETE', '/api/user', { token: seeker.token, body: { password } })).status, 200);
  assert.equal((await call('GET', '/api/user/me', { token: seeker.token })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: seeker.email, password } })).status, 401);
  assert.equal((await call('GET', `/api/Message/getMessagesBySessionId/${sid}`, { token: expert.token })).status, 403);
  assert.ok(!(await call('GET', `/api/Message/getallsessionssolver/${expert.userId}`, { token: expert.token })).json.some(s => s.sessionId === sid));
  // The photo went with the conversation, for the other participant too.
  assert.equal((await call('GET', photoUrl, { token: claimer.token })).status, 404);
  // So did the expert's saved copy of the answer.
  assert.deepEqual((await call('GET', '/api/library/saved', { token: claimer.token })).json.saved, []);

  for (const u of [expert, other, outsider]) {
    assert.equal((await call('DELETE', '/api/user', { token: u.token, body: { password } })).status, 200);
  }
  console.log('smoke-flow ok', { sessions: [sid, openId], moderation: adminKey ? 'checked' : 'skipped (no ADMIN_API_KEY)' });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
