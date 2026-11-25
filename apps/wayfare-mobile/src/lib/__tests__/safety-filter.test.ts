import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenText } from '../contentFilter';
import { buildCheckInMessage, buildSosMessage, fixAge, mapsLink, stampTime } from '../sosMessage';
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

test('SOS and check-in times carry a time zone', () => {
  const at = new Date('2026-11-17T08:35:00Z');
  // "GMT+5:30", "IST", "UTC"… whichever the phone uses, it must be there.
  assert.match(stampTime(at), /(GMT|UTC|[A-Z]{2,5})([+-]\d{1,2}(:\d{2})?)?\s*$/);
  const sos = buildSosMessage({ name: 'Asha', latitude: 32.24, longitude: 77.19, at });
  assert.ok(sos.includes(stampTime(at)));
  assert.ok(buildCheckInMessage('Asha', 'Manali', at).includes(stampTime(at)));
});

test('an old GPS fix is sent as a last-known location with its age, never as "now"', () => {
  const build = buildSosMessage;
  const now = new Date('2026-11-24T12:00:00Z');
  const old = build({ name: 'Ana', latitude: 10.1, longitude: 77.1, at: now, fixAt: new Date('2026-11-24T09:00:00Z') });
  assert.match(old, /Last known location, from 3 h ago/);
  assert.match(old, /no current fix/);
  const fresh = build({ name: 'Ana', latitude: 10.1, longitude: 77.1, at: now, fixAt: new Date('2026-11-24T11:59:30Z') });
  assert.match(fresh, /^SOS from Ana/);
  assert.doesNotMatch(fresh, /Last known/);
  assert.match(build({ name: 'Ana', latitude: null, longitude: null, at: now }), /Location unavailable/);
  assert.equal(fixAge(new Date('2026-11-24T11:48:00Z'), now), '12 min');
  assert.equal(fixAge(new Date('2026-11-21T12:00:00Z'), now), '3 days');
});
