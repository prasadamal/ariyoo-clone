import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mayReconcile, shouldApplyRemote } from '../syncRules';

test('empty cloud result removes local copies only when access was verified', () => {
  assert.equal(mayReconcile(3, false), true);
  assert.equal(mayReconcile(0, true), true, 'last item deleted on another phone');
  assert.equal(mayReconcile(0, false), false, 'could be an expired session, keep local rows');
});

test('remote wins only when newer and local has no pending edits', () => {
  assert.equal(shouldApplyRemote(null, '2026-01-01'), true);
  assert.equal(shouldApplyRemote({ sync_status: 'pending', updated_at: '2020-01-01' }, '2026-01-01'), false);
  assert.equal(shouldApplyRemote({ sync_status: 'synced', updated_at: '2026-01-02' }, '2026-01-01'), false);
  assert.equal(shouldApplyRemote({ sync_status: 'synced', updated_at: '2026-01-01' }, '2026-01-02'), true);
});
