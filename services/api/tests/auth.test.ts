import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../src/middleware/auth.js';
import { config } from '../src/config.js';
test('socket and HTTP tokens require valid identity and expiry', () => {
  const valid = jwt.sign({ userId: 1, email: 'test@example.com' }, config.jwtSecret, { expiresIn: '1h' });
  assert.equal(verifyToken(valid).userId, 1);
  for (const payload of [{ userId: -1, email: 'a' }, { userId: '1', email: 'a' }, { userId: 1 }]) {
    assert.throws(() => verifyToken(jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' })));
  }
  assert.throws(() => verifyToken(jwt.sign({ userId: 1, email: 'a' }, config.jwtSecret)));
  assert.throws(() => verifyToken('invalid'));
});
