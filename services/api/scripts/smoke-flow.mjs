const base = process.env.API_BASE || 'http://localhost:5296';

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'solver@example.com', password: 'password' }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) throw new Error(`login ${loginRes.status} ${JSON.stringify(login)}`);
  const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };

  const ask = await fetch(`${base}/api/Message/postQuestion`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      seekerId: 999,
      message: 'Smoke test: quiet cafes in Mumbai #mumbai',
      tag: [{ tagName: 'mumbai' }, { tagName: 'food' }],
    }),
  });
  const asked = await ask.json();
  if (!ask.ok) throw new Error(`ask ${ask.status} ${JSON.stringify(asked)}`);

  const sent = await fetch(`${base}/api/Message/postMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ senderId: 999, messageText: 'Follow-up from smoke test', sessionId: asked.sessionId }),
  });
  const message = await sent.json();
  if (!sent.ok) throw new Error(`send ${sent.status} ${JSON.stringify(message)}`);
  if (message.senderId !== login.userId) throw new Error('sender was not forced to the authenticated user');

  const forbidden = await fetch(`${base}/api/Message/getallsessionsseeker/999999`, { headers });
  if (forbidden.status !== 403) throw new Error(`expected 403 for other user sessions, got ${forbidden.status}`);

  const sessions = await fetch(`${base}/api/Message/getallsessionsseeker/${login.userId}`, { headers });
  const list = await sessions.json();
  if (!sessions.ok || !list.some(s => s.sessionId === asked.sessionId)) {
    throw new Error('new session missing from seeker list');
  }

  console.log(JSON.stringify({
    health: 'ok',
    userId: login.userId,
    sessionId: asked.sessionId,
    messageId: message.id,
    ignoredSpoofedSender: true,
    crossUserSessionsBlocked: true,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
