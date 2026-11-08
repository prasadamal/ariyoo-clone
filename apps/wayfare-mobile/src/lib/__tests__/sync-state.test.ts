import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSyncFlight, initialSyncState, syncReducer } from '../syncState';
import type { SyncResult } from '../sync';

const result = (errors: string[] = []): SyncResult => ({ pushed: {}, pulled: {}, removed: 0, errors });

test('partial backup keeps the last successful timestamp and remains retryable', () => {
  let state = initialSyncState('A');
  state = syncReducer(state, { type: 'start', scope: 'A', request: 1 });
  state = syncReducer(state, { type: 'finished', scope: 'A', request: 1, result: result(), at: 'yesterday' });
  state = syncReducer(state, { type: 'start', scope: 'A', request: 2 });
  state = syncReducer(state, { type: 'finished', scope: 'A', request: 2, result: result(['media failed']), at: 'today' });
  assert.equal(state.phase, 'partial');
  assert.equal(state.lastSyncAt, 'yesterday');
  state = syncReducer(state, { type: 'start', scope: 'A', request: 3 });
  assert.equal(state.phase, 'syncing');
});

test('late account results and errors cannot describe another account', () => {
  let state = syncReducer(initialSyncState('A'), { type: 'reset', scope: 'B' });
  state = syncReducer(state, { type: 'start', scope: 'B', request: 2 });
  assert.equal(syncReducer(state, { type: 'finished', scope: 'A', request: 1, result: result(), at: 'today' }), state);
  assert.equal(syncReducer(state, { type: 'failed', scope: 'A', request: 1, error: 'offline' }), state);
});

test('an old attempt cannot finish a newer attempt after returning to the same account', () => {
  let state = syncReducer(initialSyncState('A'), { type: 'start', scope: 'A', request: 3 });
  assert.equal(syncReducer(state, { type: 'finished', scope: 'A', request: 1, result: result(), at: 'old' }), state);
  assert.equal(syncReducer(state, { type: 'reset', scope: 'A' }), state);
});

test('overlapping calls share one sync only for the same account', async () => {
  let finish!: (value: string) => void;
  let calls = 0;
  const sync = createSyncFlight(async user => {
    calls++;
    return new Promise<string>(resolve => { finish = resolve; });
  });
  const first = sync('A');
  assert.equal(sync('A'), first);
  await assert.rejects(sync('B'), /Another account/);
  assert.equal(calls, 1);
  finish('A result');
  assert.equal(await first, 'A result');
  const next = sync('B');
  await Promise.resolve();
  finish('B result');
  assert.equal(await next, 'B result');
});

test('a rejected sync releases the flight so retry can succeed', async () => {
  let attempts = 0;
  const sync = createSyncFlight(async () => {
    if (++attempts === 1) throw new Error('offline');
    return 'backed up';
  });
  await assert.rejects(sync('A'), /offline/);
  assert.equal(await sync('A'), 'backed up');
});
