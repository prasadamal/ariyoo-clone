import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { io as connect } from 'socket.io-client';
import { createServer } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { config } from '../src/config.js';

test('HTTP and real socket transport enforce private chat boundaries', async () => {
  // Persistence is isolated: this test never contacts a live database.
  prisma.session.findFirst = (async ({ where }: any) => where.id === 42 && where.OR[0].seekerId === 1 ? { id: 42 } : null) as any;
  prisma.session.findUnique = (async () => ({ id: 42, seekerId: 1, solverId: 2, active: true })) as any;
  // Accounts 1 and 3 exist; nobody is suspended or blocked.
  prisma.user.findUnique = (async ({ where }: any) => ([1, 3].includes(where.id) ? { suspendedAt: null } : null)) as any;
  prisma.block.findFirst = (async () => null) as any;
  const { server, io } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const token = (userId: number) => jwt.sign({ userId, email: 'test@example.com' }, config.jwtSecret, { expiresIn: '1h' });
  const sockets: ReturnType<typeof connect>[] = [];
  try {
    const rejected = connect(base, { reconnection: false }); sockets.push(rejected);
    await new Promise<void>((resolve, reject) => {
      rejected.on('connect_error', () => resolve()); rejected.on('connect', () => reject(new Error('Anonymous connection allowed')));
    });
    for (const userId of [1, 3]) {
      const socket = connect(base, { auth: { token: token(userId) }, reconnection: false }); sockets.push(socket);
      await new Promise<void>((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); });
      const reply = await socket.timeout(2000).emitWithAck('join', '42');
      assert.equal(reply.ok, userId === 1);
      assert.equal((await socket.timeout(2000).emitWithAck('join', '../42')).ok, false);
    }
    assert.equal((await fetch(`${base}/uploads/test.jpg`)).status, 401);
    // The public topic list asks only for topics someone still holds.
    let tagQuery: any;
    prisma.tag.findMany = (async (args: any) => { tagQuery = args; return [{ id: 7, name: 'kochi' }]; }) as any;
    const topics = await fetch(`${base}/api/Tags/getAll`);
    assert.equal(topics.status, 200);
    assert.deepEqual(await topics.json(), [{ id: 7, tagName: 'kochi', description: 'tag' }]);
    assert.deepEqual(tagQuery.where, { users: { some: {} } });
    // A valid token for an account that no longer exists is refused over HTTP and sockets.
    assert.equal((await fetch(`${base}/api/user/me`, { headers: { Authorization: `Bearer ${token(99)}` } })).status, 401);
    const ghost = connect(base, { auth: { token: token(99) }, reconnection: false }); sockets.push(ghost);
    await new Promise<void>((resolve, reject) => { ghost.on('connect_error', () => resolve()); ghost.on('connect', () => reject(new Error('Deleted account connected'))); });
    // Admin routes are closed without a key: 503 while none is configured, 401 once one is.
    assert.equal((await fetch(`${base}/admin/reports`)).status, config.adminApiKey ? 401 : 503);
    assert.equal((await fetch(`${base}/admin/reports`, { headers: { 'x-admin-key': 'wrong-key' } })).status, config.adminApiKey ? 401 : 503);
    assert.equal((await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: {}, password: [] }) })).status, 400);
    for (const userId of [1, 3]) {
      const form = new FormData(); form.append('sessionId', '42'); form.append('image', new Blob(['<svg/>'], { type: 'image/png' }), 'bad.png');
      const result = await fetch(`${base}/api/Message/uploadImage`, { method: 'POST', headers: { Authorization: `Bearer ${token(userId)}` }, body: form });
      assert.equal(result.status, userId === 1 ? 415 : 403);
    }
  } finally {
    sockets.forEach(socket => socket.disconnect());
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
