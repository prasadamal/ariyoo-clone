import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addList, addToList, defaultListFor, DEFAULT_PACKING_LISTS, deleteList, listOrDefault, packCounts, packView, parseLists, removeFromList } from '../packingLists';

test('adding and removing items ignores case and spacing', () => {
  assert.deepEqual(addToList(['Phone charger'], '  phone   CHARGER '), ['Phone charger']);
  assert.deepEqual(addToList(['Phone charger'], ' Passport '), ['Phone charger', 'Passport']);
  assert.deepEqual(addToList([], '   '), []);
  assert.deepEqual(removeFromList(['Phone charger', 'Passport'], 'passport'), ['Phone charger']);
});

test('stored lists: old format, new format, broken data', () => {
  assert.deepEqual(parseLists(null), DEFAULT_PACKING_LISTS);
  assert.deepEqual(parseLists('not json'), DEFAULT_PACKING_LISTS);
  const old = parseLists(JSON.stringify({ short: ['A', 3, ''], custom: ['Camera'] }));
  assert.deepEqual(old.map(l => [l.id, l.items.length]), [['short', 1], ['long', 16], ['custom', 1]]);
  const fresh = parseLists(JSON.stringify([{ id: 'trek', name: 'Trek', items: ['Boots'] }, { id: 'bad' }]));
  assert.deepEqual(fresh.map(l => l.id), ['short', 'long', 'trek'], 'built-ins always present, broken entries dropped');
});

test('new checklists, and only custom ones can be deleted', () => {
  let lists = parseLists(null);
  lists = addList(lists, '  Wedding ', 'w1');
  assert.equal(lists.at(-1)?.name, 'Wedding');
  assert.equal(addList(lists, 'wedding', 'w2'), lists, 'names are unique');
  assert.equal(addList(lists, '  ', 'w3'), lists);
  assert.deepEqual(deleteList(lists, 'w1').map(l => l.id), ['short', 'long', 'custom']);
  assert.equal(deleteList(lists, 'short'), lists);
  assert.equal(listOrDefault(lists, 'gone').id, 'short');
});

test('trip length picks the starting list', () => {
  assert.equal(defaultListFor('2026-12-01', '2026-12-03'), 'short');
  assert.equal(defaultListFor('2026-12-01', '2026-12-10'), 'long');
  assert.equal(defaultListFor(null, null), 'short');
});

test('pack view and counts use the chosen checklist', () => {
  const lists = [
    { id: 'short', name: 'Short trip', items: ['Charger', 'Wallet'] },
    { id: 'long', name: 'Long trip', items: ['Charger', 'Jacket'] },
  ];
  const trip = [{ label: 'charger', packed: 1 }, { label: 'Jacket', packed: 0 }, { label: 'Tent', packed: 0 }];
  const v = packView(lists, 'short', trip);
  assert.deepEqual(v.rows.map(r => [r.label, r.packed]), [['Charger', true], ['Wallet', false]]);
  assert.deepEqual(v.extras.map(e => e.label), ['Tent']);
  assert.deepEqual(packCounts(lists, 'short', trip), { done: 1, total: 3 });
});
