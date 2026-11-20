import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialSaved, replaceSaved, settleToggle, startToggle } from '../src/lib/savedState';

const ids = (s: { ids: Set<number> }) => [...s.ids].sort((a, b) => a - b);

test('nobody signed in cannot save, and a double tap sends one request', () => {
  assert.equal(startToggle(initialSaved(null), 7), null);
  const first = startToggle(initialSaved(1), 7)!;
  assert.equal(first.saving, true);
  assert.deepEqual(ids(first.next), [7]);
  assert.equal(startToggle(first.next, 7), null);
});

test('a failed save or unsave puts the bookmark back', () => {
  const saving = startToggle(initialSaved(1), 7)!;
  assert.deepEqual(ids(settleToggle(saving.next, 1, 7, true, false)), []);
  const kept = settleToggle(saving.next, 1, 7, true, true);
  assert.equal(kept.pending.size, 0);
  const removing = startToggle(kept, 7)!;
  assert.equal(removing.saving, false);
  assert.deepEqual(ids(settleToggle(removing.next, 1, 7, false, false)), [7]);
});

test('replies and lists for another account are ignored; a fresh list keeps taps in flight', () => {
  const mine = startToggle(initialSaved(1), 7)!.next;
  assert.equal(settleToggle(mine, 2, 7, true, false), mine);
  assert.equal(replaceSaved(mine, 2, [99]), mine);
  // The server list is from before the tap finished: 7 stays saved, 8 arrives.
  assert.deepEqual(ids(replaceSaved(mine, 1, [8])), [7, 8]);
});
