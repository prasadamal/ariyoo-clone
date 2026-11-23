import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRich, stripRich, toggleLine, toggleWrap } from '../richText';

test('parses headings, bold, underline and colour', () => {
  const [h, p] = parseRich('# Day one\nWe **hiked** to the __lake__ and saw {orange}sunset{/}');
  assert.equal(h.kind, 'h1');
  assert.equal(h.spans.map(s => s.text).join(''), 'Day one');
  const words = p.spans.filter(s => !s.marker);
  assert.deepEqual(words.find(s => s.text === 'hiked'), { text: 'hiked', marker: false, bold: true, underline: false, color: null });
  assert.equal(words.find(s => s.text === 'lake')?.underline, true);
  assert.equal(words.find(s => s.text === 'sunset')?.color, 'orange');
  assert.equal(parseRich('## Morning')[0].kind, 'h2');
});

test('the editor sees every character; readers never see the marks', () => {
  const text = '## Notes\n**big** {blue}day{/}';
  const all = parseRich(text).map(l => l.prefix + l.spans.map(s => s.text).join('')).join('\n');
  assert.equal(all, text, 'nothing is lost while editing');
  assert.equal(stripRich(text), 'Notes\nbig day');
  assert.equal(stripRich('plain words, 2 * 3 = 6'), 'plain words, 2 * 3 = 6');
});

test('wrapping a selection toggles on and off', () => {
  const on = toggleWrap('a lovely day', { start: 2, end: 8 }, '**', '**');
  assert.deepEqual(on, { text: 'a **lovely** day', selection: { start: 4, end: 10 } });
  const off = toggleWrap(on!.text, on!.selection, '**', '**');
  assert.deepEqual(off, { text: 'a lovely day', selection: { start: 2, end: 8 } });
  assert.equal(toggleWrap('abc', { start: 1, end: 1 }, '**', '**'), null, 'nothing selected');
});

test('heading toggles apply to the cursor line', () => {
  assert.deepEqual(toggleLine('one\ntwo', 5, 'h1'), { text: 'one\n# two', cursor: 7 });
  assert.deepEqual(toggleLine('one\n# two', 7, 'h1'), { text: 'one\ntwo', cursor: 5 });
  assert.deepEqual(toggleLine('# one', 3, 'h2'), { text: '## one', cursor: 4 });
});
