import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labelsToCopy, MAX_PACKING_ITEMS } from '../packing';

test('copies only what this trip is missing, ignoring case and spacing, in source order', () => {
  assert.deepEqual(
    labelsToCopy(['Rain jacket', 'Headlamp'], ['headlamp', '  Trekking  poles ', 'Rain Jacket', '', 'Water bottle', 'trekking poles']),
    ['Trekking poles', 'Water bottle'],
  );
});

test('an empty trip takes the whole list; nothing new means nothing to add', () => {
  assert.deepEqual(labelsToCopy([], ['Socks', 'Socks', 'Gloves']), ['Socks', 'Gloves']);
  assert.deepEqual(labelsToCopy(['Socks'], ['socks']), []);
});

test('never grows a list past the limit', () => {
  const full = Array.from({ length: MAX_PACKING_ITEMS - 1 }, (_, i) => `item ${i}`);
  assert.deepEqual(labelsToCopy(full, ['Map', 'Compass']), ['Map']);
});
