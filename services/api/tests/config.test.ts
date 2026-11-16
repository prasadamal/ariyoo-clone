import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test('production refuses example secrets and unspecified origins', () => {
  const valid = {
    ...process.env,
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://isolated/example',
    JWT_SECRET: randomBytes(32).toString('hex'), CORS_ORIGINS: 'https://app.example.com',
  };
  const check = (patch: Record<string, string>) => spawnSync(process.execPath,
    ['--import', 'tsx', '-e', 'import("./src/config.ts")'], { env: { ...valid, ...patch }, encoding: 'utf8' }).status;
  assert.equal(check({}), 0);
  assert.notEqual(check({ JWT_SECRET: 'generate_a_unique_random_value_of_32_chars_or_more' }), 0);
  assert.notEqual(check({ JWT_SECRET: 'dev_secret_change_me' }), 0);
  assert.notEqual(check({ CORS_ORIGINS: '' }), 0);
  assert.notEqual(check({ CORS_ORIGINS: '*' }), 0);
  assert.notEqual(check({ DATABASE_URL: '' }), 0);
});
