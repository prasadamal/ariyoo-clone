import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery, SEARCH_MAX, snippetAround } from '../src/lib/library.js';

test('search text is trimmed, wildcard-free and at least two characters', () => {
  assert.equal(cleanQuery('  beach   shacks '), 'beach shacks');
  assert.equal(cleanQuery('50%_off\\'), '50 off');
  for (const raw of ['', ' a ', '%', '%%', '_', undefined, 42, ['beach']]) assert.equal(cleanQuery(raw), null, String(raw));
  assert.equal(cleanQuery('x'.repeat(500))!.length, SEARCH_MAX);
});

test('snippets show the matching part of a long answer, cut at words', () => {
  const long = `${'Start of a long answer about Kochi. '.repeat(6)}The best appam is at the corner shop near the ferry. ${'More words follow here. '.repeat(6)}`;
  const s = snippetAround(long, 'APPAM', 40);
  assert.ok(s.startsWith('…') && s.endsWith('…'), s);
  assert.ok(s.includes('best appam is at the corner'), s);
  // Starts at a whole word, not halfway through one.
  assert.ok(long.includes(` ${s.slice(1).split(' ')[0]} `) || long.startsWith(s.slice(1).split(' ')[0]), s);
  assert.equal(snippetAround('Short answer', 'answer'), 'Short answer');
  assert.equal(snippetAround(long, 'nowhere', 30), long.slice(0, 60).trimEnd() + '…');
  assert.equal(snippetAround('  spaced\n\nout  ', 'out'), 'spaced out');
});
