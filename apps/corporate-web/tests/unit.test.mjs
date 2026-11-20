// Unit tests for the site's pure JavaScript. Run: node --test tests/unit.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEmail, validateApplication, validateContact } from '../js/lib/validate.js';
import { problemFrom } from '../js/lib/problem.js';
import { heroStep, showcaseTick } from '../js/lib/rotation.js';

test('contact form: every missing or bad field gets its own message', () => {
  const e = validateContact({ name: ' ', email: 'nope', topic: 'spam', message: 'short' });
  assert.deepEqual(Object.keys(e).sort(), ['email', 'message', 'name', 'topic']);
  assert.deepEqual(validateContact({ name: 'Priya', email: 'priya@example.com', topic: 'investor', organisation: '', message: 'Hello, we would like to talk.' }), {});
  assert.ok(validateContact({ name: 'x'.repeat(121), email: 'a@b.co', topic: 'general', message: 'long enough text' }).name);
  assert.ok(validateContact({ name: 'P', email: 'a@b.co', topic: 'general', message: 'x'.repeat(4001) }).message);
});

test('applications: links must be http(s), and a short note is refused', () => {
  const ok = { name: 'Ravi', email: 'ravi@example.com', profileUrl: '', message: 'Six years building payment systems.' };
  assert.deepEqual(validateApplication(ok), {});
  assert.ok(validateApplication({ ...ok, profileUrl: 'javascript:alert(1)' }).profileUrl);
  assert.deepEqual(validateApplication({ ...ok, profileUrl: 'https://linkedin.com/in/ravi' }), {});
  assert.ok(validateApplication({ ...ok, message: 'too short' }).message);
});

test('email check', () => {
  for (const good of ['a@b.co', ' priya@example.com ']) assert.equal(isEmail(good), true, good);
  for (const bad of ['', 'a@b', 'no at sign', 'a @b.co', undefined]) assert.equal(isEmail(bad), false, String(bad));
});

test('failed requests become sentences a visitor can act on', () => {
  assert.match(problemFrom(0).message, /could not reach/);
  assert.match(problemFrom(429).message, /wait a minute/);
  assert.deepEqual(problemFrom(400, { message: 'Please check the highlighted fields.', fields: { email: 'Bad' } }), { message: 'Please check the highlighted fields.', fields: { email: 'Bad' } });
  assert.match(problemFrom(500, null).message, /Something went wrong/);
});

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
