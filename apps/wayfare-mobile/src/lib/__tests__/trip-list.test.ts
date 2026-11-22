import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTripFilter, pickNextUp } from '../tripList';

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
