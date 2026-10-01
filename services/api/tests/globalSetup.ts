import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Tests run against a real, throw-away Postgres started from the `embedded-postgres` npm package
 * (no Docker needed). Set TEST_DATABASE_URL to use an existing database instead (e.g. a CI service).
 */
let pg: EmbeddedPostgres | null = null;
let dir = '';

export async function setup() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariyoo-pg-'));
    const port = 54000 + Math.floor(Math.random() * 1000);
    pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false, onLog: () => {}, onError: () => {} });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('ariyoo_test');
    url = `postgresql://postgres:postgres@localhost:${port}/ariyoo_test?schema=public`;
  }
  process.env.DATABASE_URL = url;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}

export async function teardown() {
  if (pg) await pg.stop();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}
