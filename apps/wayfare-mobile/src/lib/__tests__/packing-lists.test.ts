import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addToList, defaultListFor, DEFAULT_PACKING_LISTS, packView, parseLists, removeFromList } from '../packingLists';

test('adding and removing ignores case and spacing', () => {
  assert.deepEqual(addToList(['Phone charger'], '  phone   CHARGER '), ['Phone charger']);
  assert.deepEqual(addToList(['Phone charger'], ' Passport '), ['Phone charger', 'Passport']);
  assert.deepEqual(addToList([], '   '), []);
  assert.deepEqual(removeFromList(['Phone charger', 'Passport'], 'passport'), ['Phone charger']);
});

test('stored lists are read defensively', () => {
  assert.deepEqual(parseLists(null), DEFAULT_PACKING_LISTS);
  assert.deepEqual(parseLists('not json'), DEFAULT_PACKING_LISTS);
  const r = parseLists(JSON.stringify({ short: ['A', 3, ''], custom: ['Camera'] }));
  assert.deepEqual(r.short, ['A']);
  assert.deepEqual(r.long, DEFAULT_PACKING_LISTS.long);
  assert.deepEqual(r.custom, ['Camera']);
});

test('trip length picks the starting list', () => {
  assert.equal(defaultListFor('2026-12-01', '2026-12-03'), 'short');
  assert.equal(defaultListFor('2026-12-01', '2026-12-10'), 'long');
  assert.equal(defaultListFor(null, null), 'short');
});

test('pack view: list items show this trip\'s ticks, other trip items are extras', () => {
  const lists = { short: ['Charger', 'Wallet'], long: ['Charger', 'Jacket'], custom: [] };
  const trip = [
    { label: 'charger', packed: 1 },
    { label: 'Jacket', packed: 0 },
    { label: 'Tent', packed: 0 },
  ];
  const v = packView(lists, 'short', trip);
  assert.deepEqual(v.rows.map(r => [r.label, r.packed]), [['Charger', true], ['Wallet', false]]);
  assert.deepEqual(v.extras.map(e => e.label), ['Tent'], 'Jacket belongs to the long list, so it is not an extra');
});
