import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addList, addToList, defaultListFor, DEFAULT_PACKING_LISTS, deleteList, listNameProblem, listOrDefault, MAX_LIST_NAME, packCounts, packView, parseLists, removeFromList } from '../packingLists';

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

test('one list of your own: the empty Custom placeholder goes, extra lists merge into the first', () => {
  const placeholder = parseLists(JSON.stringify([{ id: 'short', name: 'Short trip', items: ['A'] }, { id: 'custom', name: 'Custom', items: [] }]));
  assert.deepEqual(placeholder.map(l => l.id), ['short', 'long']);
  const many = parseLists(JSON.stringify([
    { id: 'trek', name: 'Trek', items: ['Boots', 'Poles'] },
    { id: 'work', name: 'Work', items: ['Laptop', 'boots'] },
    { id: 'custom', name: 'Custom', items: [] },
  ]));
  assert.deepEqual(many.map(l => l.id), ['short', 'long', 'trek']);
  assert.deepEqual(many[2].items, ['Boots', 'Poles', 'Laptop'], 'items kept once each');
});

test('new checklists: one of your own, a short unique name, and only yours can be deleted', () => {
  let lists = parseLists(null);
  assert.equal(listNameProblem(lists, '   '), 'Give the list a name.');
  assert.match(listNameProblem(lists, 'x'.repeat(MAX_LIST_NAME + 1)) ?? '', /letters/);
  assert.match(listNameProblem(lists, 'short TRIP') ?? '', /already/);
  lists = addList(lists, '  Wedding ', 'w1');
  assert.equal(lists.at(-1)?.name, 'Wedding');
  assert.equal(lists.length, 3);
  assert.equal(addList(lists, 'Trek', 'w2'), lists, 'three lists at most');
  assert.match(listNameProblem(lists, 'Trek') ?? '', /one list of your own/);
  assert.deepEqual(deleteList(lists, 'w1').map(l => l.id), ['short', 'long']);
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
