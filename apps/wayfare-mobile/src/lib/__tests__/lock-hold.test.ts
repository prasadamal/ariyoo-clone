import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdLock, isLockHeld, LOCK_GRACE_MS, shouldLockOnReturn } from '../lockHold';

test('the camera or picker opened by Wayfare never locks on return', () => {
  assert.equal(shouldLockOnReturn(10 * 60_000, true), false);
});

test('a quick trip out (share sheet, UPI app) stays unlocked; a longer absence locks', () => {
  assert.equal(shouldLockOnReturn(5_000, false), false);
  assert.equal(shouldLockOnReturn(LOCK_GRACE_MS, false), true);
});

test('the hold is on while the picker is open', async () => {
  let during = false;
  await holdLock(async () => {
    during = isLockHeld();
  });
  assert.equal(during, true);
});
