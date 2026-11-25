import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingCount, unsavedNotice, unsavedText } from '../unsavedChanges';

test('a demoted editor gets a copy of every word they typed offline, oldest moment first', () => {
  const rows = {
    entries: [
      { body: 'Sunset at the fort', recorded_at: '2026-11-20T18:00:00Z' },
      { body: '  Chai with Meera  ', recorded_at: '2026-11-20T09:00:00Z' },
      { body: null, recorded_at: '2026-11-20T10:00:00Z' },
    ],
    expenses: [{ category: 'food', amount: 450, currency: 'INR', note: 'Thali' }],
    plans: [{ title: 'Fort walk', notes: null }],
    other: 2,
  };
  assert.equal(unsavedText(rows), '• Chai with Meera\n• Sunset at the fort\n• food: INR 450 (Thali)\n• Plan: Fort walk');
  assert.equal(pendingCount(rows), 7);
});

test('the notice says how many changes were lost and what to do', () => {
  assert.match(unsavedNotice(1), /1 change you made offline/);
  assert.match(unsavedNotice(3), /3 changes you made offline/);
  assert.match(unsavedNotice(3), /Copy your words/);
});
