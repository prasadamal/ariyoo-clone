import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJournalGate } from '../journalGate';

test('wipe waits for replication and later sync waits for wipe', async () => {
  const exclusive = createJournalGate();
  const events: string[] = [];
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const sync = exclusive(async () => { events.push('sync'); await pending; events.push('saved'); });
  const wipe = exclusive(async () => { events.push('wipe'); });
  const next = exclusive(async () => { events.push('next'); });
  await Promise.resolve();
  assert.deepEqual(events, ['sync']);
  finish();
  await Promise.all([sync, wipe, next]);
  assert.deepEqual(events, ['sync', 'saved', 'wipe', 'next']);
});
test('a failed operation releases the journal', async () => {
  const exclusive = createJournalGate();
  const failed = exclusive(async () => { throw new Error('disk full'); });
  const next = exclusive(async () => 'retry');
  await assert.rejects(failed, /disk full/);
  assert.equal(await next, 'retry');
});
