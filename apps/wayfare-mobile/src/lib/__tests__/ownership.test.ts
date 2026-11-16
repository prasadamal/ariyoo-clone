import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveJournalOwnership } from '../ownership';

test('existing journals are never adopted by another account', async () => {
  let adopted = false;
  const result = await resolveJournalOwnership('new', () => true, {
    owner: async () => 'old', count: async () => 1, adopt: async () => { adopted = true; },
  });
  assert.equal(result, 'conflict');
  assert.equal(adopted, false);
});
test('account switch during a read prevents adoption', async () => {
  let current = true;
  let adopted = false;
  const result = await resolveJournalOwnership('old', () => current, {
    owner: async () => { current = false; return null; }, count: async () => 0, adopt: async () => { adopted = true; },
  });
  assert.equal(result, 'stale');
  assert.equal(adopted, false);
});
test('storage failure is not treated as an empty journal', async () => {
  await assert.rejects(resolveJournalOwnership('new', () => true, {
    owner: async () => 'old', count: async () => { throw new Error('disk unavailable'); },
    adopt: async () => { assert.fail('must not adopt'); },
  }), /disk unavailable/);
});
test('an empty journal can change owner only after its count is confirmed', async () => {
  let owner = 'old';
  assert.equal(await resolveJournalOwnership('new', () => true, {
    owner: async () => owner, count: async () => 0, adopt: async id => { owner = id; },
  }), 'ready');
  assert.equal(owner, 'new');
});
