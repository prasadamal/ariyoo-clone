import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATIONS } from '../../content/destinations';
import { inSeason, isValidPlaceKey, matchDestination, placeKeyFor, placeLabel, searchDestinations, slugify } from '../places';

test('catalog keys are unique, valid and well-formed', () => {
  const keys = DESTINATIONS.map(d => d.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const d of DESTINATIONS) {
    assert.ok(isValidPlaceKey(d.key), d.key);
    assert.ok(d.bestMonths.every(m => m >= 1 && m <= 12), d.key);
    assert.ok(Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180, d.key);
    assert.ok(d.budgetPerDayInr[0] <= d.budgetPerDayInr[1], d.key);
  }
});

test('aliases never collide across destinations', () => {
  const seen = new Map<string, string>();
  for (const d of DESTINATIONS) {
    for (const a of [d.key, ...(d.aliases ?? [])]) {
      const prev = seen.get(slugify(a));
      assert.ok(!prev || prev === d.key, `${a} used by ${prev} and ${d.key}`);
      seen.set(slugify(a), d.key);
    }
  }
});

test('slugify', () => {
  assert.equal(slugify('  Spiti   Valley!! '), 'spiti-valley');
  assert.equal(slugify('Café & Crêpes'), 'cafe-and-crepes');
  assert.equal(slugify('a'.repeat(80)).length, 60);
});

test('free text resolves to the same key travellers share', () => {
  assert.equal(placeKeyFor('Kedarkantha Trek'), 'kedarkantha');
  assert.equal(placeKeyFor('kedarkantha'), 'kedarkantha');
  assert.equal(placeKeyFor('Leh'), 'ladakh');
  assert.equal(placeKeyFor('EBC'), 'everest-base-camp');
  assert.equal(placeKeyFor('Old Manali, Himachal'), 'manali');
  assert.equal(placeKeyFor('Ziro Valley Trip'), 'ziro-valley');
  assert.equal(placeKeyFor('  '), null);
  assert.equal(matchDestination('mcleodganj')?.key, 'dharamshala');
});

test('labels and search', () => {
  assert.equal(placeLabel('kedarkantha'), 'Kedarkantha');
  assert.equal(placeLabel('ziro-valley'), 'Ziro Valley');
  assert.equal(searchDestinations({ query: 'kedar' })[0].key, 'kedarkantha');
  assert.ok(searchDestinations({ kind: 'beach' }).every(d => d.kinds.includes('beach')));
  assert.ok(searchDestinations({ month: 1 }).every(d => d.bestMonths.includes(1)));
  assert.ok(inSeason(12).length > 5);
});
