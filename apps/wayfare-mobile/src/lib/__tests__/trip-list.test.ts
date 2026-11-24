import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTripFilter, featuredTrips, pickNextUp, recentFirst, statusCounts, statusTrips, tileCount, tripStatus } from '../tripList';

const today = new Date('2026-11-22T10:00:00');
const trip = (id: string, starts_on: string | null, ends_on: string | null = starts_on, status = 'active') => ({ id, starts_on, ends_on, status });
const trips = [
  trip('past', '2026-10-01', '2026-10-05'),
  trip('now', '2026-11-20', '2026-11-25'),
  trip('soon', '2026-11-30'),
  trip('later', '2027-01-10'),
  trip('done', '2026-11-28', '2026-11-29', 'completed'),
];

test('the journey on top is the current or soonest one, never a completed one', () => {
  assert.equal(pickNextUp(trips, today)?.id, 'now');
  assert.equal(pickNextUp(trips.filter(t => t.id !== 'now'), today)?.id, 'soon');
  assert.equal(pickNextUp([trip('past', '2026-01-01')], today), null);
});

test('the list below never repeats the journey on top', () => {
  assert.deepEqual(applyTripFilter(trips, 'all', 'now', today).map(t => t.id), ['past', 'soon', 'later', 'done']);
  assert.deepEqual(applyTripFilter(trips, 'upcoming', 'now', today).map(t => t.id), ['soon', 'later']);
  assert.deepEqual(applyTripFilter(trips, 'past', 'now', today).map(t => t.id), ['past', 'done']);
});

test('three featured tiles: on the road, next up, most recently finished', () => {
  const today = new Date(2026, 10, 24);
  const t = (id: string, s: string | null, e: string | null, status = 'active', updated_at = '2026-11-01T00:00:00Z') => ({ id, status, starts_on: s, ends_on: e, updated_at });
  const trips = [
    t('past-old', '2026-01-02', '2026-01-05'),
    t('past-new', '2026-10-01', '2026-10-04'),
    t('done-early', '2026-12-20', '2026-12-22', 'completed'),
    t('now', '2026-11-23', '2026-11-26'),
    t('soon', '2026-11-30', '2026-11-30'),
    t('later', '2027-01-10', '2027-01-12'),
    t('plan', null, null),
  ];
  const f = featuredTrips(trips, today);
  assert.equal(f.ongoing?.id, 'now');
  assert.equal(f.upcoming?.id, 'soon', 'dated trips before undated plans');
  assert.equal(f.completed?.id, 'done-early', 'marked completed counts as done');
  assert.equal(tripStatus(t('x', null, null), today), 'upcoming');
  assert.deepEqual(featuredTrips([t('plan', null, null)], today), { ongoing: null, upcoming: trips[6], completed: null });
  assert.deepEqual(recentFirst(trips).map(x => x.id), ['later', 'done-early', 'soon', 'now', 'plan', 'past-new', 'past-old']);
});

test('status counts group every journey once', () => {
  const today = new Date('2026-11-23T10:00:00');
  const trips = [
    { id: 'a', status: 'active', starts_on: '2026-11-22', ends_on: '2026-11-26' },
    { id: 'b', status: 'active', starts_on: '2026-12-15', ends_on: '2026-12-22' },
    { id: 'c', status: 'active', starts_on: null, ends_on: null },
    { id: 'd', status: 'completed', starts_on: '2026-03-12', ends_on: '2026-03-16' },
    { id: 'e', status: 'active', starts_on: '2026-01-01', ends_on: '2026-01-03' },
  ];
  assert.deepEqual(statusCounts(trips, today), { ongoing: 1, upcoming: 2, completed: 2 });
});

test('a group list: upcoming soonest first (undated plans last), completed newest first', () => {
  const today = new Date('2026-11-23T10:00:00');
  const trips = [
    { id: 'late', status: 'active', starts_on: '2027-02-01', ends_on: '2027-02-05' },
    { id: 'plan', status: 'active', starts_on: null, ends_on: null, updated_at: '2026-11-01' },
    { id: 'soon', status: 'active', starts_on: '2026-12-15', ends_on: '2026-12-22' },
    { id: 'old', status: 'completed', starts_on: '2026-03-12', ends_on: '2026-03-16' },
    { id: 'recent', status: 'completed', starts_on: '2026-10-01', ends_on: '2026-10-05' },
  ];
  assert.deepEqual(statusTrips(trips, 'upcoming', today).map(t => t.id), ['soon', 'late', 'plan']);
  assert.deepEqual(statusTrips(trips, 'completed', today).map(t => t.id), ['recent', 'old']);
});

test('every journey tile has a count: to go, day of, length, or a plain word', () => {
  const today = new Date(2026, 10, 24);
  const t = (starts_on: string | null, ends_on: string | null, status = 'planned') => ({ id: 'x', status, starts_on, ends_on });
  assert.deepEqual(tileCount(t('2026-12-01', '2026-12-05'), today), { value: '7', caption: 'days to go' });
  assert.deepEqual(tileCount(t('2026-11-25', null), today), { value: '1', caption: 'day to go' });
  assert.deepEqual(tileCount(t(null, null), today), { value: '–', caption: 'no dates yet' });
  assert.deepEqual(tileCount(t('2026-11-22', '2026-11-26'), today), { value: 'Day 3', caption: 'of 5' });
  assert.deepEqual(tileCount(t('2026-11-01', '2026-11-05'), today), { value: '5', caption: 'day trip' });
  assert.deepEqual(tileCount(t('2026-11-01', null, 'completed'), today), { value: '1', caption: 'day trip' });
  // Marked complete before its dates: still the planned length.
  assert.deepEqual(tileCount(t('2026-12-01', '2026-12-03', 'completed'), today), { value: '3', caption: 'day trip' });
  assert.deepEqual(tileCount(t(null, null, 'completed'), today), { value: '✓', caption: 'completed' });
});
