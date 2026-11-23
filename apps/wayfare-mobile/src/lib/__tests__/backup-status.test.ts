import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupLabel, backupState, signOutMessage } from '../backupStatus';

const base = { syncing: false, errors: [] as string[], pending: 0 as number | null, lastSyncAt: '2026-11-23T10:00:00Z' };

test('only a clean sync with zero counted changes is verified', () => {
  assert.equal(backupState(base), 'verified');
  assert.equal(backupState({ ...base, lastSyncAt: null }), 'unverified');
  assert.equal(backupState({ ...base, pending: null }), 'unknown');
  assert.equal(backupState({ ...base, pending: 3 }), 'waiting');
  assert.equal(backupState({ ...base, errors: ['media abc: timeout'] }), 'error');
  assert.equal(backupState({ ...base, syncing: true }), 'syncing');
});

test('a failed count or failed sync never says "backed up"', () => {
  for (const i of [
    { ...base, pending: null },
    { ...base, errors: ['x'] },
    { ...base, lastSyncAt: null },
    { ...base, syncing: true },
  ]) {
    assert.doesNotMatch(signOutMessage(i), /^Your journals are backed up/);
    assert.doesNotMatch(backupLabel(i), /Everything is backed up/);
  }
  assert.match(signOutMessage(base), /^Your journals are backed up/);
});

test('waiting count is pluralised', () => {
  assert.equal(backupLabel({ ...base, pending: 1 }), '1 change waiting to sync');
  assert.match(signOutMessage({ ...base, pending: 2 }), /^2 changes have not synced/);
});
