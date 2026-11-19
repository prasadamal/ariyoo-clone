import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createServer } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { config } from '../src/config.js';

// Persistence is isolated: every query this route makes is answered here, never by a live database.
test('only the asker closes a question, exactly once, and thanks reach the expert only when it helped', async () => {
  type Row = { id: number; seekerId: number; solverId: number | null; active: boolean; resolvedAt: Date | null; helpful: boolean | null };
  const rows = new Map<number, Row>([
    [10, { id: 10, seekerId: 1, solverId: 2, active: true, resolvedAt: null, helpful: null }],
    [11, { id: 11, seekerId: 1, solverId: null, active: true, resolvedAt: null, helpful: null }],
  ]);
  const pushedTo: number[][] = [];
  prisma.user.findUnique = (async ({ where }: any) => ([1, 2, 3].includes(where.id) ? { suspendedAt: null } : null)) as any;
  prisma.block.findFirst = (async () => null) as any;
  prisma.session.findUnique = (async ({ where }: any) => rows.get(where.id) ?? null) as any;
  prisma.session.updateMany = (async ({ where, data }: any) => {
    const row = rows.get(where.id);
    if (!row || row.resolvedAt !== null) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  }) as any;
  prisma.session.count = (async ({ where }: any) =>
    [...rows.values()].filter(r => r.solverId === where.solverId && (where.helpful ? r.helpful === true : r.resolvedAt !== null)).length) as any;
  prisma.pushToken.findMany = (async ({ where }: any) => { pushedTo.push(where.userId.in); return []; }) as any;

  const { server, io } = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const as = (userId: number) => ({ Authorization: `Bearer ${jwt.sign({ userId, email: 'test@example.com' }, config.jwtSecret, { expiresIn: '1h' })}`, 'Content-Type': 'application/json' });
  const resolve = (userId: number, id: number | string, body: unknown = {}) =>
    fetch(`${base}/api/Message/resolve/${id}`, { method: 'POST', headers: as(userId), body: JSON.stringify(body) });
  try {
    // The expert and a stranger cannot close the asker's question, and learn nothing about it.
    assert.equal((await resolve(2, 10, { helpful: true })).status, 404);
    assert.equal((await resolve(3, 10, { helpful: true })).status, 404);
    assert.equal((await resolve(1, 'abc')).status, 400);
    assert.equal((await resolve(1, 10, { helpful: 'yes' })).status, 400);
    assert.equal(rows.get(10)!.resolvedAt, null);

    const first = await resolve(1, 10, { helpful: true });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { sessionId: 10, resolved: true, helpful: true });
    assert.equal(rows.get(10)!.active, false);
    // A double tap or a second device does not close it again or send a second thank-you.
    const again = await resolve(1, 10, { helpful: false });
    assert.equal(again.status, 409);
    assert.equal((await again.json()).code, 'ALREADY_RESOLVED');
    assert.equal(rows.get(10)!.helpful, true);

    // Withdrawn before any expert answered: closed, nobody thanked even if asked to.
    const withdrawn = await resolve(1, 11, { helpful: true });
    assert.deepEqual(await withdrawn.json(), { sessionId: 11, resolved: true, helpful: null });
    await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(pushedTo, [[2]]);

    // The asker now sees the expert's record next to the conversation.
    prisma.session.findUnique = (async ({ where }: any) => {
      const row = rows.get(where.id);
      return row && { ...row, title: 'Where to eat?', seeker: { id: 1, fullName: 'Asker' }, solver: row.solverId ? { id: 2, fullName: 'Expert' } : null };
    }) as any;
    const info = await (await fetch(`${base}/api/Message/session/10`, { headers: as(1) })).json();
    assert.equal(info.resolved, true);
    assert.equal(info.helpful, true);
    assert.deepEqual(info.peerStats, { answered: 1, helpful: 1 });
    const expertView = await (await fetch(`${base}/api/Message/session/10`, { headers: as(2) })).json();
    assert.equal(expertView.peerStats, null);
  } finally {
    await new Promise<void>(resolve => io.close(() => resolve()));
  }
});
