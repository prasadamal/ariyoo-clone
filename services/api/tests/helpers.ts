import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../src/config';
import { createApp } from '../src/app';
import { attachRealtime } from '../src/realtime';

export const db = new PrismaClient();

export function makeConfig(over: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
    CORS_ORIGINS: 'http://allowed.example',
    UPLOAD_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ariyoo-up-')),
    RATE_LIMIT_MAX: '1000',
    AUTH_RATE_LIMIT_MAX: '1000',
    ...over
  } as NodeJS.ProcessEnv);
}

export function makeServer(over: Record<string, string> = {}) {
  const config = makeConfig(over);
  const server = http.createServer();
  const rt = attachRealtime(server, db, config);
  const app = createApp({ db, config, publish: rt.publish });
  server.on('request', app);
  return { app, server, config, rt };
}

let n = 0;
export async function signup(app: any, opts: { isSolver?: boolean; password?: string } = {}) {
  const email = `u${Date.now()}${n++}@example.com`;
  const res = await request(app).post('/auth/register').send({ email, password: opts.password ?? 'password123', flname: 'Test User', isSolver: !!opts.isSolver });
  if (res.status !== 201) throw new Error('signup failed ' + JSON.stringify(res.body));
  return { email, userId: res.body.userId as number, token: res.body.token as string };
}

export const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
