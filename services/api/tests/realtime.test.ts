import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { AddressInfo } from 'net';
import { io as connect, Socket } from 'socket.io-client';
import { auth, db, makeServer, signup } from './helpers';

const ctx = makeServer();
let url = '';

beforeAll(async () => {
  await new Promise<void>(r => ctx.server.listen(0, r));
  url = `http://localhost:${(ctx.server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  ctx.rt.io?.close();
  await db.$disconnect();
});

const open = (token?: string, origin?: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, extraHeaders: origin ? { Origin: origin } : undefined });
    s.on('connect', () => resolve(s));
    s.on('connect_error', e => { s.close(); reject(e); });
  });
const join = (s: Socket, id: number) => new Promise<boolean>(r => s.emit('join', id, (a: { ok: boolean }) => r(a.ok)));

describe('socket.io', () => {
  it('rejects connections without or with a bad JWT', async () => {
    await expect(open()).rejects.toThrow(/unauthorized/);
    await expect(open('bad.token.here')).rejects.toThrow(/unauthorized/);
  });

  it('only participants can join; messages are pushed from REST writes; clients cannot broadcast', async () => {
    const a = await signup(ctx.app), b = await signup(ctx.app, { isSolver: true }), c = await signup(ctx.app);
    // unique tag so matching deterministically picks `b` even if other solvers exist in the shared test DB
    const tagName = `rt${Date.now()}`;
    await request(ctx.app).post('/api/Tags/addUserTags').set(auth(b.token)).send([{ tagName }]);
    const q = await request(ctx.app).post('/api/Message/postQuestion').set(auth(a.token)).send({ message: 'hello?', tag: [{ tagName }] });
    const sessionId = q.body.sessionId;

    const sa = await open(a.token), sb = await open(b.token), sc = await open(c.token);
    expect(await join(sa, sessionId)).toBe(true);
    expect(await join(sb, sessionId)).toBe(true);
    expect(await join(sc, sessionId)).toBe(false);

    const gotB = new Promise<any>(r => sb.once('message', r));
    const leaked: any[] = [];
    sc.on('message', m => leaked.push(m));
    await request(ctx.app).post('/api/Message/postMessage').set(auth(a.token)).send({ sessionId, messageText: 'ping' });
    const m = await gotB;
    expect(m).toMatchObject({ messageText: 'ping', senderId: a.userId });

    // a raw client-side "message" emit is ignored (no server handler => nothing is broadcast)
    const spoofSeen: any[] = [];
    sb.on('message', x => spoofSeen.push(x));
    sc.emit('message', { sessionId, messageText: 'spoof', senderId: a.userId });
    await new Promise(r => setTimeout(r, 300));
    expect(spoofSeen).toHaveLength(0);
    expect(leaked).toHaveLength(0);
    [sa, sb, sc].forEach(s => s.close());
  });
});
