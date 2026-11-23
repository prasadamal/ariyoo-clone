import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enqueue, MAX_QUEUE, scrubDetail, shouldCount, type QueuedEvent } from '../telemetryRules';

test('error text leaves no personal details', () => {
  const s = scrubDetail('Failed for amal@example.com at file:///data/user/0/x/photo.jpg id 9876543210 https://x.co/a?token=abc eyJhbGc.eyJzdWIi.sig')!;
  assert.doesNotMatch(s, /amal@|9876543210|token=abc|\/data\/user|eyJhbGc/);
  assert.match(s, /<email>/);
  assert.equal(scrubDetail(null), null);
  assert.equal(scrubDetail('x'.repeat(3000))!.length, 1501);
});

test('the waiting list is capped, oldest dropped first', () => {
  let q: QueuedEvent[] = [];
  for (let i = 0; i < MAX_QUEUE + 5; i++) q = enqueue(q, { kind: 'event', name: `e${i}`, detail: null, at: '' });
  assert.equal(q.length, MAX_QUEUE);
  assert.equal(q[0].name, 'e5');
});

test('app_open counts once a day', () => {
  assert.equal(shouldCount('app_open', '2026-11-24', '2026-11-24'), false);
  assert.equal(shouldCount('app_open', '2026-11-23', '2026-11-24'), true);
  assert.equal(shouldCount('moment_added', '2026-11-24', '2026-11-24'), true);
});
