import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { auth, db, makeServer, signup } from './helpers';

const { app } = makeServer();

afterAll(() => db.$disconnect());

describe('health & hardening', () => {
  it('GET /health reports db up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('unknown route -> JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });
  it('malformed JSON -> 400, not 500', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
  it('CORS: allowed origin echoed, other origin not', async () => {
    const ok = await request(app).get('/health').set('Origin', 'http://allowed.example');
    expect(ok.headers['access-control-allow-origin']).toBe('http://allowed.example');
    const bad = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('rate limiting returns 429 on auth routes', async () => {
    const { app: limited } = makeServer({ AUTH_RATE_LIMIT_MAX: '3' });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await request(limited).post('/auth/login').send({ email: 'x@example.com', password: 'bad' })).status);
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
  });
});

describe('config', () => {
  it('refuses to start in production without secrets / with placeholder', async () => {
    const { loadConfig } = await import('../src/config');
    expect(() => loadConfig({ NODE_ENV: 'production' } as any)).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'x', JWT_SECRET: 'change_me'.repeat(5), CORS_ORIGINS: 'https://a.com' } as any)).toThrow(/placeholder/);
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'x', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: '*' } as any)).toThrow(/CORS/);
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'x', JWT_SECRET: 'a'.repeat(40), CORS_ORIGINS: 'https://a.com' } as any).corsOrigins).toEqual(['https://a.com']);
  });
});

describe('auth', () => {
  it('register -> login -> /me; never leaks passwordHash', async () => {
    const u = await signup(app);
    expect(u.token).toBeTruthy();
    const login = await request(app).post('/auth/login').send({ email: u.email, password: 'password123' });
    expect(login.status).toBe(200);
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash/);
    const me = await request(app).get('/auth/me').set(auth(login.body.token));
    expect(me.body.userId).toBe(u.userId);
  });
  it('rejects duplicate email (409), bad password (401), weak password (400), bad email (400)', async () => {
    const u = await signup(app);
    expect((await request(app).post('/auth/register').send({ email: u.email, password: 'password123', flname: 'x' })).status).toBe(409);
    expect((await request(app).post('/auth/login').send({ email: u.email, password: 'wrongwrong' })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'wrongwrong' })).status).toBe(401);
    expect((await request(app).post('/auth/register').send({ email: 'a@example.com', password: 'short', flname: 'x' })).status).toBe(400);
    expect((await request(app).post('/auth/register').send({ email: 'not-an-email', password: 'password123', flname: 'x' })).status).toBe(400);
  });
  it('protected routes require a valid token', async () => {
    expect((await request(app).get('/api/Message/getallsessionsseeker/1')).status).toBe(401);
    expect((await request(app).get('/api/Message/getallsessionsseeker/1').set(auth('garbage'))).status).toBe(401);
  });
  it('change password works and validates old password', async () => {
    const u = await signup(app);
    expect((await request(app).put('/api/user/updatepassword').set(auth(u.token)).send({ oldPassword: 'nope', newPassword: 'newpassword1' })).status).toBe(400);
    expect((await request(app).put('/api/user/updatepassword').set(auth(u.token)).send({ oldPassword: 'password123', newPassword: 'newpassword1' })).status).toBe(200);
    expect((await request(app).post('/auth/login').send({ email: u.email, password: 'newpassword1' })).status).toBe(200);
  });
});

describe('ownership: sessions & messages', () => {
  let seeker: Awaited<ReturnType<typeof signup>>, solver: Awaited<ReturnType<typeof signup>>, outsider: Awaited<ReturnType<typeof signup>>;
  let sessionId: number;
  beforeAll(async () => {
    seeker = await signup(app);
    solver = await signup(app, { isSolver: true });
    outsider = await signup(app);
    const tagName = `goa${Date.now()}`;
    await request(app).post('/api/Tags/addUserTags').set(auth(solver.token)).send([{ tagName }]);
    const res = await request(app).post('/api/Message/postQuestion').set(auth(seeker.token)).send({ message: 'Where to eat in Goa?', tag: [{ tagName }] });
    expect(res.status).toBe(201);
    sessionId = res.body.sessionId;
  });

  it('postQuestion ignores body seekerId and assigns the question to the real expert', async () => {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(s.seekerId).toBe(seeker.userId);
    expect(s.solverId).toBe(solver.userId);
    const spoof = await request(app).post('/api/Message/postQuestion').set(auth(outsider.token)).send({ seekerId: seeker.userId, message: 'spoof' });
    const s2 = await db.session.findUniqueOrThrow({ where: { id: spoof.body.sessionId } });
    expect(s2.seekerId).toBe(outsider.userId);
  });
  it('postQuestion validates body', async () => {
    expect((await request(app).post('/api/Message/postQuestion').set(auth(seeker.token)).send({})).status).toBe(400);
    expect((await request(app).post('/api/Message/postQuestion').set(auth(seeker.token)).send({ message: 'x'.repeat(6000) })).status).toBe(400);
  });
  it("cannot list another user's sessions", async () => {
    expect((await request(app).get(`/api/Message/getallsessionsseeker/${seeker.userId}`).set(auth(outsider.token))).status).toBe(403);
    const mine = await request(app).get(`/api/Message/getallsessionsseeker/${seeker.userId}`).set(auth(seeker.token));
    expect(mine.status).toBe(200);
    expect(mine.body.map((s: any) => s.sessionId)).toContain(sessionId);
    const theirs = await request(app).get(`/api/Message/getallsessionssolver/${solver.userId}`).set(auth(solver.token));
    expect(theirs.body.map((s: any) => s.sessionId)).toContain(sessionId);
  });
  it('non-participants cannot read or write a session (404)', async () => {
    expect((await request(app).get(`/api/Message/getMessagesBySessionId/${sessionId}`).set(auth(outsider.token))).status).toBe(404);
    expect((await request(app).post('/api/Message/postMessage').set(auth(outsider.token)).send({ sessionId, messageText: 'hi' })).status).toBe(404);
  });
  it('participants can read/write; senderId comes from the token, not body', async () => {
    const res = await request(app).post('/api/Message/postMessage').set(auth(solver.token)).send({ sessionId, messageText: 'Try the shacks', senderId: seeker.userId });
    expect(res.status).toBe(201);
    expect(res.body.senderId).toBe(solver.userId);
    const list = await request(app).get(`/api/Message/getMessagesBySessionId/${sessionId}`).set(auth(seeker.token));
    expect(list.body.map((m: any) => m.messageText)).toEqual(['Where to eat in Goa?', 'Try the shacks']);
  });
  it('postMessage validates input', async () => {
    expect((await request(app).post('/api/Message/postMessage').set(auth(seeker.token)).send({ sessionId, messageText: '' })).status).toBe(400);
    expect((await request(app).post('/api/Message/postMessage').set(auth(seeker.token)).send({ sessionId: 'abc', messageText: 'x' })).status).toBe(400);
  });
  it('image upload: valid PNG ok, wrong content / type / outsider rejected', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const ok = await request(app).post('/api/Message/uploadImage').set(auth(seeker.token)).field('sessionId', String(sessionId)).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.imageUrl).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    const served = await request(app).get(ok.body.imageUrl);
    expect(served.status).toBe(200);
    const fake = await request(app).post('/api/Message/uploadImage').set(auth(seeker.token)).field('sessionId', String(sessionId)).attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    const html = await request(app).post('/api/Message/uploadImage').set(auth(seeker.token)).field('sessionId', String(sessionId)).attach('image', Buffer.from('<html>'), { filename: 'a.html', contentType: 'text/html' });
    expect(html.status).toBe(415);
    const out = await request(app).post('/api/Message/uploadImage').set(auth(outsider.token)).field('sessionId', String(sessionId)).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    expect(out.status).toBe(404);
  });
});

describe('ownership: tags, places, profile', () => {
  it('per-user data is private and writes target the token user', async () => {
    const a = await signup(app), b = await signup(app);
    const add = await request(app).post('/api/Tags/addUserTags').set(auth(a.token)).send([{ tagName: 'Hiking' }]);
    expect(add.status).toBe(200);
    expect((await request(app).post('/api/Tags/addUserTags').set(auth(a.token)).send([{ tagName: 'x', userId: b.userId }])).status).toBe(403);
    expect((await request(app).get(`/api/Tags/getUserTags/${a.userId}`).set(auth(b.token))).status).toBe(403);
    const mine = await request(app).get(`/api/Tags/getUserTags/${a.userId}`).set(auth(a.token));
    expect(mine.body.map((t: any) => t.tagName)).toEqual(['hiking']);
    expect((await request(app).get(`/api/Tags/getUserTags/${a.userId}`)).status).toBe(401);
  });
  it("cannot delete another user's place; owner can", async () => {
    const a = await signup(app), b = await signup(app);
    const p = await request(app).post('/api/Tags/addUserPlace').set(auth(a.token)).send({ placeName: 'Kochi' });
    expect(p.status).toBe(200);
    await request(app).delete(`/api/Tags/deleteUserPlace/${p.body.id}`).set(auth(b.token));
    expect((await request(app).get(`/api/Tags/getUserPlaces/${a.userId}`).set(auth(a.token))).body).toHaveLength(1);
    await request(app).delete(`/api/Tags/deleteUserPlace/${p.body.id}`).set(auth(a.token));
    expect((await request(app).get(`/api/Tags/getUserPlaces/${a.userId}`).set(auth(a.token))).body).toHaveLength(0);
  });
  it('user update only affects self; body id mismatch -> 403; no hash returned', async () => {
    const a = await signup(app), b = await signup(app);
    expect((await request(app).put('/api/user').set(auth(a.token)).send({ id: b.userId, fullName: 'Hacked' })).status).toBe(403);
    const ok = await request(app).put('/api/user').set(auth(a.token)).send({ fullName: 'New Name', isSolver: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ fullName: 'New Name', isSolver: true });
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash/);
    expect((await db.user.findUniqueOrThrow({ where: { id: b.userId } })).fullName).toBe('Test User');
  });
  it('public catalogues work; newsletter is validated and idempotent', async () => {
    expect((await request(app).get('/api/Tags/getAll')).status).toBe(200);
    expect((await request(app).post('/api/newsletter').send({ email: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/newsletter').send({ email: 'n@example.com' })).status).toBe(200);
    expect((await request(app).post('/api/newsletter').send({ email: 'n@example.com' })).status).toBe(200);
  });
});
