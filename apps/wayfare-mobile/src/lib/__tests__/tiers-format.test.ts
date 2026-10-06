import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compactNumber,
  dayCount,
  daysUntil,
  formatDateRange,
  formatKm,
  initials,
  timeAgo,
  tripPhase,
} from '../format';
import { computeTier, nextTierProgress } from '../tiers';

test('tiers match the server rules', () => {
  assert.equal(computeTier(0, 0), 'traveler');
  assert.equal(computeTier(99.9, 3999), 'traveler');
  assert.equal(computeTier(100, 0), 'hardcore');
  assert.equal(computeTier(10, 4000), 'hardcore');
  assert.equal(computeTier(500, 0), 'legendary');
  assert.equal(computeTier(0, 5500), 'legendary');
});

test('next tier progress takes the closer path', () => {
  const p = nextTierProgress(50, 3800);
  assert.equal(p.next, 'hardcore');
  assert.equal(p.progress, 0.95);
  assert.match(p.hint, /4,000 m/);
  assert.equal(nextTierProgress(600, 0).next, null);
});

test('timeAgo', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  assert.equal(timeAgo('2026-10-06T11:59:30Z', now), 'just now');
  assert.equal(timeAgo('2026-10-06T11:15:00Z', now), '45m');
  assert.equal(timeAgo('2026-10-06T07:00:00Z', now), '5h');
  assert.equal(timeAgo('2026-10-03T12:00:00Z', now), '3d');
  assert.equal(timeAgo(null, now), '');
});

test('date helpers treat YYYY-MM-DD as calendar days', () => {
  assert.equal(dayCount('2026-12-20', '2026-12-25'), 6);
  assert.equal(dayCount('2026-12-20', null), 1);
  assert.equal(dayCount(null, null), 0);
  assert.equal(formatDateRange('2026-12-20', '2026-12-25'), '20–25 Dec 2026');
  const today = new Date(2026, 9, 6);
  assert.equal(tripPhase('2026-10-10', '2026-10-12', today), 'upcoming');
  assert.equal(tripPhase('2026-10-05', '2026-10-07', today), 'ongoing');
  assert.equal(tripPhase('2026-09-01', null, today), 'past');
  assert.equal(tripPhase(null, null, today), 'undated');
  assert.equal(daysUntil('2026-10-16', today), 10);
});

test('small formatters', () => {
  assert.equal(formatKm(0.42), '420 m');
  assert.equal(formatKm(12.345), '12.3 km');
  assert.equal(formatKm(1234.4), '1,234 km');
  assert.equal(compactNumber(1530), '1.5k');
  assert.equal(compactNumber(25000), '25k');
  assert.equal(initials('asha rao singh'), 'AS');
  assert.equal(initials(''), '?');
});
