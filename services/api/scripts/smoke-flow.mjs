const base = process.env.API_URL || process.env.API_BASE || 'http://localhost:5296';

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

  console.log('smoke-flow ok', { sessionId: asked.sessionId });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
