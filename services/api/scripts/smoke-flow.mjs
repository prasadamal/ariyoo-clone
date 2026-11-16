const base = process.env.API_URL || process.env.API_BASE || 'http://localhost:3333';
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error('Set DEMO_PASSWORD for an isolated reviewer/test database');

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'solver@example.com', password }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) throw new Error(`login ${loginRes.status} ${JSON.stringify(login)}`);
  const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };

  const ask = await fetch(`${base}/api/Message/postQuestion`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'Smoke test: quiet cafes in Mumbai #mumbai',
      tag: [{ tagName: 'mumbai' }, { tagName: 'food' }],
    }),
  });
  const asked = await ask.json();
  if (!ask.ok) throw new Error(`ask ${ask.status} ${JSON.stringify(asked)}`);

  const sent = await fetch(`${base}/api/Message/postMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      senderId: login.userId,
      messageText: 'Smoke test reply',
      sessionId: asked.sessionId,
    }),
  });
  if (!sent.ok) throw new Error(`message ${sent.status}`);

  const history = await fetch(`${base}/api/Message/getMessagesBySessionId/${asked.sessionId}`, { headers });
  if (!history.ok || (await history.json()).length !== 2) throw new Error('Persisted history did not contain both messages');
  const outsiderRes = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `smoke-${Date.now()}@example.com`, password, flname: 'Isolated smoke user', isSeeker: true, isSolver: false }),
  });
  if (!outsiderRes.ok) throw new Error('Could not create isolated outsider');
  const outsider = await outsiderRes.json();
  const denied = await fetch(`${base}/api/Message/getMessagesBySessionId/${asked.sessionId}`, {
    headers: { Authorization: `Bearer ${outsider.token}` },
  });
  if (denied.status !== 403) throw new Error('Outsider could read persisted chat');
  console.log('smoke-flow ok' , { sessionId: asked.sessionId });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
