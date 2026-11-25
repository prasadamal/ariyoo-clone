import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guestBackupNotice } from '../guestBackupText';

test('a guest is told their phone journals will be backed up when they sign in', () => {
  assert.equal(guestBackupNotice({ trips: 0, entries: 0 }), null);
  assert.match(guestBackupNotice({ trips: 1, entries: 4 })!, /^The journey on this phone, with its photos/);
  assert.match(guestBackupNotice({ trips: 3, entries: 0 })!, /^The 3 journeys on this phone/);
  assert.match(guestBackupNotice({ trips: 0, entries: 2 })!, /^Your diary on this phone/);
  assert.match(guestBackupNotice({ trips: 2, entries: 9 })!, /backed up to this account and kept private to you/);
});
