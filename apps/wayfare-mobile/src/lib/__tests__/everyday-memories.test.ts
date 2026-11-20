import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVERYDAY_TRIP_TYPE, journeysOnly, onThisDay, wroteToday, yearsAgoLabel } from '../everydayMemories';

// Local-time timestamps, so the tests mean the same thing in every time zone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const entry = (id: string, recorded_at: string) => ({ id, trip_id: 't', recorded_at, body: id, mood: null, place_name: null });

test('the everyday journal is never listed as a journey', () => {
  const trips = [{ id: 'a', trip_type: 'trek' }, { id: 'b', trip_type: EVERYDAY_TRIP_TYPE }, { id: 'c', trip_type: 'city' }];
  assert.deepEqual(journeysOnly(trips).map(t => t.id), ['a', 'c']);
});

test('on this day groups earlier years newest first and ignores this year and other dates', () => {
  const today = new Date(2026, 10, 20, 9);
  const groups = onThisDay([
    entry('2024-evening', at(2024, 11, 20, 21)),
    entry('2025', at(2025, 11, 20)),
    entry('2024-morning', at(2024, 11, 20, 7)),
    entry('this-year', at(2026, 11, 20, 8)),
    entry('next-day', at(2025, 11, 21)),
    entry('other-month', at(2025, 10, 20)),
  ], today);
  assert.deepEqual(groups.map(g => [g.year, g.yearsAgo]), [[2025, 1], [2024, 2]]);
  assert.deepEqual(groups[1].entries.map(e => e.id), ['2024-morning', '2024-evening']);
});

test('29 February memories surface on 28 February in non-leap years, and only then', () => {
  const leapEntry = entry('leap', at(2024, 2, 29));
  assert.equal(onThisDay([leapEntry], new Date(2025, 1, 28)).length, 1);
  assert.equal(onThisDay([leapEntry], new Date(2025, 2, 1)).length, 0);
  assert.equal(onThisDay([leapEntry], new Date(2028, 1, 28)).length, 0);
  assert.equal(onThisDay([leapEntry], new Date(2028, 1, 29)).length, 1);
});

test('nothing to remember yields an empty list, and bad dates are skipped', () => {
  assert.deepEqual(onThisDay([], new Date(2026, 0, 1)), []);
  assert.deepEqual(onThisDay([entry('bad', 'not a date')], new Date(2026, 0, 1)), []);
});

test('labels and the written-today check', () => {
  assert.equal(yearsAgoLabel(1), '1 year ago');
  assert.equal(yearsAgoLabel(4), '4 years ago');
  const today = new Date(2026, 10, 20, 18);
  assert.equal(wroteToday([{ recorded_at: at(2026, 11, 20, 8) }], today), true);
  assert.equal(wroteToday([{ recorded_at: at(2026, 11, 19, 23) }], today), false);
});
