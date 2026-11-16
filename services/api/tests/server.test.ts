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
  prisma.session.findUnique = (async () => ({ id: 42, seekerId: 1, solverId: 2 })) as any;
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
