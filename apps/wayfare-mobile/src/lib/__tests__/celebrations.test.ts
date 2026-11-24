import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeLevels, badgeToast, isCodeList, isLevelMap, newBadgeLevels, newStampCodes, parseSeen, stampDelay } from '../celebrations';

const badges = [
  { id: 'journeys', level: 1, title: 'First Steps I' },
  { id: 'countries', level: 2, title: 'Globetrotter II' },
  { id: 'photos', level: 0, title: 'Shutterbug' },
];

test('first look at badges celebrates nothing and remembers the levels', () => {
  assert.deepEqual(newBadgeLevels(null, badges), []);
  assert.deepEqual(badgeLevels(badges), { journeys: 1, countries: 2 });
});

test('a badge that went up a level is new; same or unearned ones are not', () => {
  const fresh = newBadgeLevels({ journeys: 1, countries: 1 }, badges);
  assert.deepEqual(fresh.map(b => b.id), ['countries']);
  assert.equal(badgeToast(fresh), 'New badge: Globetrotter II');
  assert.deepEqual(newBadgeLevels({ journeys: 1 }, badges).map(b => b.id), ['countries']);
  assert.equal(badgeToast([]), null);
  assert.equal(badgeToast(badges.slice(0, 2)), '2 new badges: First Steps I, Globetrotter II');
});

test('passport: the first visit lands every visited stamp, later only new countries', () => {
  const stamps = [
    { code: 'IN', upcoming: false },
    { code: 'TH', upcoming: false },
    { code: 'JP', upcoming: true },
  ];
  assert.deepEqual(newStampCodes(null, stamps), ['IN', 'TH']);
  assert.deepEqual(newStampCodes(['IN'], stamps), ['TH']);
  assert.deepEqual(newStampCodes(['IN', 'TH'], stamps), []);
});

test('stamps land one after another, capped', () => {
  assert.equal(stampDelay(0), 0);
  assert.equal(stampDelay(2), 280);
  assert.equal(stampDelay(50), stampDelay(8));
});

test('stored values that are broken or the wrong shape read as never seen', () => {
  assert.equal(parseSeen('{oops', isLevelMap), null);
  assert.equal(parseSeen('["IN"]', isLevelMap), null);
  assert.deepEqual(parseSeen('{"a":1}', isLevelMap), { a: 1 });
  assert.deepEqual(parseSeen('["IN","TH"]', isCodeList), ['IN', 'TH']);
  assert.equal(parseSeen('[1]', isCodeList), null);
  assert.equal(parseSeen(null, isCodeList), null);
});
