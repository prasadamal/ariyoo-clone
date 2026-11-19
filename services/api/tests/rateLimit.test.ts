import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createServer, rateLimitKey } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { config } from '../src/config.js';

const request = (headers: Record<string, string>) => ({ headers, ip: '203.0.113.7' }) as any;

test('signed-in requests are counted per account; forged tokens fall back to the address', () => {
  const token = jwt.sign({ userId: 42, email: 'a@example.com' }, config.jwtSecret, { expiresIn: '1h' });
  assert.equal(rateLimitKey(request({ authorization: `Bearer ${token}` })), 'user:42');
  const forged = jwt.sign({ userId: 42, email: 'a@example.com' }, 'not-the-server-secret', { expiresIn: '1h' });
  assert.match(rateLimitKey(request({ authorization: `Bearer ${forged}` })), /^ip:/);
  assert.match(rateLimitKey(request({})), /^ip:/);
});

test('sign-in is limited per address and email, so one guessed account does not block the others', async () => {
  // No account exists: every login is a clean 401 unless the limiter steps in first.
  prisma.user.findUnique = (async () => null) as any;
  const { server, io } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/auth/login`;
  const login = (email: string) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'wrong-password-123' }) }).then(r => r.status);
  try {
    const guessing: number[] = [];
    for (let i = 0; i < 31; i++) guessing.push(await login('victim@example.com'));
    assert.equal(guessing.filter(s => s === 401).length, 30);
    assert.equal(guessing.at(-1), 429);
    // Someone else behind the same address can still sign in.
    assert.equal(await login('neighbour@example.com'), 401);
  } finally {
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
