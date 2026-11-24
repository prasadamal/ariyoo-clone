import assert from 'node:assert/strict';
import test from 'node:test';
import { passportStamps, stampMonth, stampTilt } from '../passport';

const trip = (id: string, place_key: string | null, starts_on: string | null) => ({ id, title: id, destination: null, place_key, starts_on, ends_on: null, status: 'active' });
const entry = (recorded_at: string, country_code: string | null, region: string | null = null) => ({ trip_id: 'x', recorded_at, mood: null, place_name: null, weather: null, region, country_code });

test('a stamp per country, dated with the first visit, oldest first', () => {
  const stamps = passportStamps(
    [trip('goa', 'goa', '2026-03-12')],
    [entry('2026-04-06T08:00:00', 'NP', 'Bagmati'), entry('2026-04-08T08:00:00', 'np', 'Gandaki'), entry('2025-11-22T09:00:00', 'IN', 'Rajasthan')],
    '2026-11-24'
  );
  assert.deepEqual(stamps.map(s => s.code), ['IN', 'NP']);
  assert.equal(stamps[0].firstDay, '2025-11-22', 'India from the earliest moment, not the later Goa trip');
  assert.equal(stamps[0].states, 2, 'Rajasthan and Goa');
  assert.equal(stamps[1].states, 2, 'Bagmati and Gandaki, country codes in any case');
  assert.ok(stamps.every(s => !s.upcoming));
});

test('a country only in a journey that has not started is a faded upcoming stamp, listed last', () => {
  const stamps = passportStamps([trip('hg', 'vietnam', '2026-12-15'), trip('goa', 'goa', '2026-03-12')], [], '2026-11-24');
  assert.deepEqual(stamps.map(s => [s.code, s.upcoming]), [['IN', false], ['VN', true]]);
  const reached = passportStamps([trip('hg', 'vietnam', '2026-12-15')], [entry('2026-12-15T10:00:00', 'VN')], '2026-12-16');
  assert.equal(reached[0].upcoming, false, 'once a moment is written there, it is a real stamp');
});

test('stamp month and tilt are stable', () => {
  assert.equal(stampMonth('2026-04-06'), 'APR 2026');
  assert.equal(stampTilt('IN'), stampTilt('IN'));
  assert.ok(Math.abs(stampTilt('LK')) <= 4);
});
