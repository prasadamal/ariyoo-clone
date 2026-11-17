import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSolver, scoreMatch } from '../src/utils/matching.js';
import { containsBlockedContent } from '../src/lib/contentFilter.js';
import { buildPush, EXPO_TOKEN } from '../src/lib/push.js';

test('matching picks a topic expert, shares the load and never the asker or a blocked member', () => {
  const experts = [
    { id: 1, tags: ['goa', 'beaches'], activeSessions: 4 },
    { id: 2, tags: ['Goa'], activeSessions: 0 },
    { id: 3, tags: ['goa', 'beaches'], activeSessions: 1 },
    { id: 4, tags: ['kerala'], activeSessions: 0 },
  ];
  assert.equal(scoreMatch(['Goa', 'food'], ['goa', 'FOOD', 'x']), 2);
  // Best score first; among equal scores the less busy expert.
  assert.equal(pickSolver(experts, ['goa', 'beaches'], new Set()), 3);
  assert.equal(pickSolver(experts, ['goa'], new Set()), 2);
  assert.equal(pickSolver(experts, ['goa', 'beaches'], new Set([3])), 1);
  // Nobody knows the topic, or no topics given: the question goes to the open queue.
  assert.equal(pickSolver(experts, ['tokyo'], new Set()), null);
  assert.equal(pickSolver(experts, [], new Set()), null);
  assert.equal(pickSolver([], ['goa'], new Set()), null);
});

test('content filter catches whole blocked words, including simple disguises, and nothing else', () => {
  assert.equal(containsBlockedContent('you should kill yourself'), true);
  assert.equal(containsBlockedContent('K.Y.S'.replace(/\./g, '')), true);
  assert.equal(containsBlockedContent('n1gger'), true);
  assert.equal(containsBlockedContent('Best beaches in Goa? Any skyscraper views?'), false);
  assert.equal(containsBlockedContent('grapes and therapist recommendations'), false);
  assert.equal(containsBlockedContent(''), false);
  assert.equal(containsBlockedContent(null), false);
  process.env.CONTENT_BLOCKLIST = 'Spamword, buy followers';
  assert.equal(containsBlockedContent('please BUY   followers now'), true);
  assert.equal(containsBlockedContent('spamwords'), false);
  delete process.env.CONTENT_BLOCKLIST;
});

test('push payloads carry no message text and skip malformed tokens', () => {
  const good = 'ExponentPushToken[abc_DEF-123]';
  assert.ok(EXPO_TOKEN.test(good));
  const out = buildPush([good, 'not-a-token', 'https://evil.test'], 'reply', 7);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].data, { sessionId: 7, kind: 'reply' });
  assert.equal(out[0].body, 'You have a new message in Ariyoo.');
});
