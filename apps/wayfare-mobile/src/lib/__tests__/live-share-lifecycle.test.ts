import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revokeLiveShare, acknowledgeLivePush } from '../liveShareLifecycle';

type State = { id: string; lastPushAt?: string };
test('failed revocation keeps the link for retry', async () => {
  let state: State | null = { id: 'old' };
  await assert.rejects(revokeLiveShare({ read: async () => state, write: async value => { state = value; },
    expire: async () => { throw new Error('offline'); } }), /offline/);
  assert.deepEqual(state, { id: 'old' });
  await revokeLiveShare({ read: async () => state, write: async value => { state = value; }, expire: async () => {} });
  assert.equal(state, null);
});
test('revoking an older link cannot clear a newly created link', async () => {
  let state: State | null = { id: 'old' };
  await revokeLiveShare({ read: async () => state, write: async value => { state = value; },
    expire: async () => { state = { id: 'new' }; } });
  assert.deepEqual(state, { id: 'new' });
});
test('an old push cannot resurrect stopped sharing', async () => {
  let state: State | null = null;
  await acknowledgeLivePush({ read: async () => state, write: async value => { state = value; } }, 'old', 'now');
  assert.equal(state, null);
});
