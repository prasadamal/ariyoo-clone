// Unit tests for the site's pure JavaScript (animation timing). Run: node --test tests/unit.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heroStep, showcaseTick } from '../js/lib/rotation.js';

test('hero phones change one at a time: middle, right, left, and wrap around', () => {
  let s = [0, 0, 0];
  s = heroStep(s, 0); assert.deepEqual(s, [0, 1, 0]);
  s = heroStep(s, 1); assert.deepEqual(s, [0, 1, 1]);
  s = heroStep(s, 2); assert.deepEqual(s, [1, 1, 1]);
  s = heroStep(s, 3); s = heroStep(s, 6); assert.deepEqual(s, [1, 0, 1]);
});

test('showcase timer: counts only while running and not paused, then moves on and wraps', () => {
  const opts = { step: 100, interval: 300, count: 3 };
  let s = { current: 2, elapsed: 0, running: true };
  s = showcaseTick(s, { ...opts, paused: true }); assert.equal(s.elapsed, 0);
  s = showcaseTick(s, { ...opts, paused: false }); assert.equal(s.elapsed, 100);
  s = showcaseTick(s, { ...opts, paused: false });
  s = showcaseTick(s, { ...opts, paused: false }); assert.deepEqual(s, { current: 0, elapsed: 0, running: true });
  const stopped = { current: 1, elapsed: 50, running: false };
  assert.equal(showcaseTick(stopped, { ...opts, paused: false }), stopped);
});
