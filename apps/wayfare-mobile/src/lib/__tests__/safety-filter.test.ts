import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenText } from '../contentFilter';
import { buildSosMessage, mapsLink } from '../sosMessage';
import { weatherCodeIcon, weatherCodeLabel } from '../weather';
import { shouldApplyRemote } from '../syncRules';

test('content filter blocks abuse and scams but not ordinary travel talk', () => {
  for (const ok of [
    'Who reached Juda ka Talab first?',
    'Carry fire retardant gloves for the stove',
    'Scunthorpe to Shimla, what a trip',
    'Randi and I are heading to Spiti',
    'Be careful: there was an assault near the bus stand, travel in groups',
    'Split cab Dehradun → Sankri, ₹1,200 each, pay the driver directly',
  ]) {
    assert.deepEqual(screenText(ok), { ok: true }, ok);
  }
  for (const bad of ['what the fuck', 'f.u.c.k this', 'you w h o r e', 'Send advance deposit to confirm your seat']) {
    assert.equal(screenText(bad).ok, false, bad);
  }
});

test('SOS message carries coordinates, map link and live link', () => {
  const msg = buildSosMessage({
    name: 'Asha',
    latitude: 31.02261,
    longitude: 78.17083,
    accuracyM: 12.4,
    altitudeM: 3412,
    at: new Date('2026-12-21T05:30:00Z'),
    tripTitle: 'Kedarkantha winter',
    liveUrl: 'https://example.org/live?id=abc',
  });
  assert.match(msg, /^SOS from Asha via Wayfare/);
  assert.match(msg, /31\.02261, 78\.17083 \(±12 m\), altitude ~3412 m/);
  assert.ok(msg.includes(mapsLink(31.02261, 78.17083)));
  assert.match(msg, /Live location: https:\/\/example\.org\/live\?id=abc/);
  assert.match(buildSosMessage({ name: null, latitude: null, longitude: null, at: new Date() }), /Location unavailable/);
});

test('weather codes follow WMO groups', () => {
  assert.equal(weatherCodeLabel(53), 'Drizzle');
  assert.equal(weatherCodeLabel(63), 'Rain');
  assert.equal(weatherCodeLabel(86), 'Snow showers');
  assert.equal(weatherCodeLabel(95), 'Thunderstorm');
  assert.equal(weatherCodeIcon(0), 'weather-sunny');
  assert.equal(weatherCodeLabel(null), 'Weather');
});

test('pull merge rule protects unsynced local edits', () => {
  const synced = { sync_status: 'synced', updated_at: '2026-10-01T10:00:00Z' };
  assert.equal(shouldApplyRemote(null, '2026-10-01T09:00:00Z'), true);
  assert.equal(shouldApplyRemote(synced, '2026-10-01T11:00:00Z'), true);
  assert.equal(shouldApplyRemote(synced, '2026-10-01T10:00:00Z'), false);
  assert.equal(shouldApplyRemote({ ...synced, sync_status: 'pending' }, '2027-01-01T00:00:00Z'), false);
  assert.equal(shouldApplyRemote(synced, null), false);
});
