import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeBadges, sortBadges } from '../badges';
import { cleanTrack, elevationStats, regionFor, trackDistanceKm, type TrackPoint } from '../geo';
import { computeTravelStats, countryPlaces, countrySummary, flagEmoji, longestStreak, stateWord } from '../travelStats';
import { buildWrapped, whereYouWent } from '../wrapped';

function climb(n: number, start = Date.parse('2026-12-21T02:00:00Z')): TrackPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    recorded_at: new Date(start + i * 600_000).toISOString(),
    latitude: 31.02 + i * 0.009,
    longitude: 78.17,
    altitude_m: 2800 + i * 120,
    accuracy_m: 10,
  }));
}

test('spike filter and distance mirror the server calculation', () => {
  const pts = climb(11);
  // A 1,000 km glitch one second after the first fix must vanish.
  pts.push({ recorded_at: new Date(Date.parse(pts[0].recorded_at) + 1000).toISOString(), latitude: 40, longitude: 78.17, altitude_m: 3000, accuracy_m: 10 });
  // An inaccurate fix is ignored too.
  pts.push({ recorded_at: pts[5].recorded_at, latitude: 10, longitude: 10, altitude_m: 9999, accuracy_m: 500 });
  assert.equal(cleanTrack(pts).length, 11);
  const km = trackDistanceKm(pts);
  assert.ok(km > 9.9 && km < 10.1, `distance ${km}`);
  const elev = elevationStats(pts);
  assert.equal(elev.maxM, 4000);
  assert.equal(elev.gainM, 1200);
});

test('elevation hysteresis ignores GPS altitude noise', () => {
  const noisy: TrackPoint[] = Array.from({ length: 30 }, (_, i) => ({
    recorded_at: new Date(Date.parse('2026-01-01T00:00:00Z') + i * 60_000).toISOString(),
    latitude: 30 + i * 0.0005,
    longitude: 78,
    altitude_m: 2000 + (i % 2 === 0 ? 3 : -3),
  }));
  assert.equal(elevationStats(noisy).gainM, 0);
});

test('regionFor pads and enforces a minimum zoom', () => {
  const r = regionFor([{ latitude: 10, longitude: 20 }]);
  assert.equal(r?.latitudeDelta, 0.02);
  assert.equal(regionFor([]), null);
});

test('streaks count consecutive local days', () => {
  const d = (s: string) => new Date(s).toISOString();
  assert.equal(longestStreak([d('2026-03-01T10:00'), d('2026-03-02T09:00'), d('2026-03-02T20:00'), d('2026-03-03T08:00'), d('2026-03-05T08:00')]), 3);
  assert.equal(longestStreak([]), 0);
});

const input = {
  trips: [
    { id: 't1', title: 'KK', destination: 'Kedarkantha', place_key: 'kedarkantha', starts_on: '2026-12-20', ends_on: '2026-12-25', status: 'completed' },
    { id: 't2', title: 'EBC', destination: 'Everest Base Camp', place_key: 'everest-base-camp', starts_on: '2026-04-01', ends_on: '2026-04-14', status: 'active' },
    { id: 't3', title: 'Old', destination: 'Goa', place_key: 'goa', starts_on: '2025-01-01', ends_on: '2025-01-03', status: 'completed' },
  ],
  entries: [
    { trip_id: 't1', recorded_at: new Date('2026-12-21T05:10:00').toISOString(), mood: '🥶 Cold', place_name: 'Juda ka Talab', weather: 'Snow, -4°C' },
    { trip_id: 't1', recorded_at: new Date('2026-12-22T23:30:00').toISOString(), mood: '🔥 Epic', place_name: 'Summit', weather: 'Clear' },
    { trip_id: 't2', recorded_at: new Date('2026-04-03T12:00:00').toISOString(), mood: '🔥 Epic', place_name: 'Namche', weather: 'Rain showers' },
    { trip_id: 't3', recorded_at: new Date('2025-01-02T12:00:00').toISOString(), mood: '😊 Great', place_name: 'Palolem', weather: null },
  ],
  expenses: [
    { trip_id: 't1', amount: 1500, currency: 'INR', spent_on: '2026-12-20' },
    { trip_id: 't2', amount: 9000, currency: 'NPR', spent_on: '2026-04-02' },
  ],
  trackPointsByTrip: { t1: climb(11) },
  photos: 3,
  voiceNotes: 1,
};

test('travel stats + badges', () => {
  const stats = computeTravelStats(input);
  assert.equal(stats.trips, 3);
  assert.equal(stats.completedTrips, 2);
  assert.equal(stats.countries, 2);
  assert.equal(stats.destinations, 3);
  assert.equal(stats.longestTripDays, 14);
  assert.equal(stats.earlyBirdEntries, 1);
  assert.equal(stats.nightOwlEntries, 1);
  assert.equal(stats.snowEntries, 1);
  assert.equal(stats.rainEntries, 1);
  assert.equal(stats.maxAltitudeM, 4000);
  const badges = computeBadges(stats);
  const byId = new Map(badges.map(b => [b.id, b]));
  // Levelled families: 3 journeys is First Steps I (next level at 10); 14 days is Long Haul II.
  assert.equal(byId.get('journeys')?.level, 1);
  assert.equal(byId.get('journeys')?.title, 'First Steps I');
  assert.equal(byId.get('journeys')?.target, 10);
  assert.equal(byId.get('long-trip')?.level, 2);
  // Two countries is Globetrotter I; the old weather and altitude one-offs are gone.
  assert.equal(byId.get('countries')?.level, 1);
  for (const gone of ['thin-air', 'cloud-walker', 'snow-chaser', 'monsoon-soul']) assert.ok(!byId.has(gone), gone);
  assert.ok(badges.length <= 10);
  const sorted = sortBadges(badges);
  assert.ok(sorted[0].earned && !sorted[sorted.length - 1].earned);
});

test('distance badge levels climb by plain rules', () => {
  const base = computeTravelStats(input);
  const at = (km: number) => computeBadges({ ...base, kmTravelled: km }).find(b => b.id === 'distance')!;
  assert.equal(at(999).level, 0);
  assert.equal(at(1000).level, 1);
  assert.equal(at(10000).level, 2);
  assert.equal(at(50000).level, 3);
  assert.equal(at(100000).level, 4);
  assert.equal(at(100000).progress, 1);
  assert.equal(at(5500).progress, 0.5);
});

test('distance travelled uses moment locations when no route was recorded', () => {
  const stats = computeTravelStats({
    trips: [{ id: 'x', title: 'Road trip', destination: null, place_key: null, starts_on: null, ends_on: null, status: 'active' }],
    entries: [
      { trip_id: 'x', recorded_at: '2026-01-01T08:00:00Z', mood: null, place_name: null, weather: null, latitude: 12.97, longitude: 77.59, region: 'Karnataka', country_code: 'IN' },
      { trip_id: 'x', recorded_at: '2026-01-01T18:00:00Z', mood: null, place_name: null, weather: null, latitude: 9.93, longitude: 76.26, region: 'Kerala', country_code: 'IN' },
    ],
    trackPointsByTrip: {},
    photos: 0,
    voiceNotes: 0,
  });
  assert.ok(stats.kmTravelled > 350 && stats.kmTravelled < 400, `${stats.kmTravelled}`); // Bengaluru → Kochi
  assert.deepEqual(stats.states, ['Karnataka', 'Kerala']);
  assert.deepEqual(stats.countryCodes, ['IN']);
});

test('wrapped only counts the chosen year', () => {
  const w = buildWrapped(2026, input, [
    { at: '2026-04-03T12:00:00Z', audio: false },
    { at: '2026-12-21T06:00:00Z', audio: true },
    { at: '2025-01-02T12:00:00Z', audio: false },
  ]);
  assert.equal(w.stats.trips, 2);
  assert.equal(w.stats.entries, 3);
  assert.equal(w.stats.photos, 1);
  assert.equal(w.stats.voiceNotes, 1);
  assert.equal(w.topMood, '🔥 Epic');
  assert.deepEqual(w.destinations.sort(), ['Everest Base Camp', 'Kedarkantha']);
  assert.deepEqual(w.spendByCurrency, { INR: 1500, NPR: 9000 });
  assert.equal(w.persona.title, 'The Summit Seeker');
  assert.equal(w.busiestMonth, 'December');
  assert.equal(buildWrapped(2024, input).persona.title, 'The Dreamer');
});

test('places visited are grouped by country', () => {
  const e = (region: string | null, country_code: string | null) => ({ trip_id: 'x', recorded_at: '2026-01-01T08:00:00Z', mood: null, place_name: null, weather: null, latitude: null, longitude: null, region, country_code });
  const stats = computeTravelStats({
    trips: [{ id: 'x', title: 'Trip', destination: null, place_key: null, starts_on: null, ends_on: null, status: 'active' }],
    entries: [e('Kerala', 'in'), e('Karnataka', 'IN'), e('Kerala', 'IN'), e('Bagmati', 'NP'), e('Somewhere', null)],
    trackPointsByTrip: {},
    photos: 0,
    voiceNotes: 0,
  });
  assert.deepEqual(stats.statesByCountry, { IN: ['Karnataka', 'Kerala'], NP: ['Bagmati'], '': ['Somewhere'] });
});

test('wrapped leaves out journeys that have not started yet', () => {
  const upcoming = { id: 'soon', title: 'Ha Giang', destination: 'Ha Giang', place_key: null, starts_on: '2026-12-10', ends_on: '2026-12-16', status: 'planning' };
  const w = buildWrapped(2026, { ...input, trips: [...input.trips, upcoming] }, [], '2026-11-23');
  assert.ok(!w.destinations.includes('Ha Giang'));
  assert.equal(buildWrapped(2026, { ...input, trips: [...input.trips, upcoming] }, [], '2026-12-11').destinations.includes('Ha Giang'), true);
});

const placeEntry = (place_name: string | null, region: string | null, country_code: string | null) => ({ trip_id: 'x', recorded_at: '2026-01-01T08:00:00Z', mood: null, place_name, weather: null, latitude: null, longitude: null, region, country_code });

test('places visited: states hold the places you went, each counted once', () => {
  const stats = computeTravelStats({
    trips: [],
    entries: [
      placeEntry('Munnar', 'Kerala', 'IN'),
      placeEntry('munnar', 'Kerala', 'IN'),
      placeEntry('Varkala Cliff', 'Kerala', 'IN'),
      placeEntry('Leh', 'Ladakh', 'IN'),
      placeEntry(null, 'Goa', 'IN'),
      placeEntry('Goa', 'Goa', 'IN'),
      placeEntry('Kandy', 'Central Province', 'LK'),
    ],
    trackPointsByTrip: {},
    photos: 0,
    voiceNotes: 0,
  });
  const india = countryPlaces(stats, 'IN');
  assert.deepEqual(india.states.map(s => s.name), ['Goa', 'Kerala', 'Ladakh']);
  assert.deepEqual(india.states.find(s => s.name === 'Kerala')!.places, ['Munnar', 'Varkala Cliff']);
  assert.equal(india.placeCount, 3);
  assert.equal(countrySummary('IN', india.states.length, india.placeCount), '3 states · 3 places');
  const lk = countryPlaces(stats, 'LK');
  assert.equal(countrySummary('LK', lk.states.length, lk.placeCount), '1 province · 1 place');
  assert.equal(countrySummary('', 0, 0), 'Visited');
  assert.equal(stateWord('JP', 2), 'prefectures');
  assert.equal(stateWord('ZZ', 1), 'region');
});

test('where you went: countries when you crossed a border, else states, else destinations', () => {
  const names = { flag: flagEmoji, country: (c: string) => ({ IN: 'India', NP: 'Nepal' } as Record<string, string>)[c] ?? c };
  const base = computeTravelStats({ trips: [], entries: [placeEntry('Leh', 'Ladakh', 'IN'), placeEntry('Pokhara', 'Gandaki', 'NP')], trackPointsByTrip: {}, photos: 0, voiceNotes: 0 });
  const multi = whereYouWent({ stats: base, destinations: ['Ladakh', 'Poon Hill'] }, names)!;
  assert.equal(multi.noun, 'countries');
  assert.equal(multi.count, 2);
  assert.deepEqual(multi.items.map(i => i.name), ['India', 'Nepal']);
  assert.equal(multi.items[0].flag, '🇮🇳');
  const one = computeTravelStats({ trips: [], entries: [placeEntry('Leh', 'Ladakh', 'IN'), placeEntry('Munnar', 'Kerala', 'IN')], trackPointsByTrip: {}, photos: 0, voiceNotes: 0 });
  const states = whereYouWent({ stats: one, destinations: [] }, names)!;
  assert.equal(states.noun, 'states');
  assert.deepEqual(states.items.map(i => i.name), ['Kerala', 'Ladakh']);
  const none = computeTravelStats({ trips: [], entries: [], trackPointsByTrip: {}, photos: 0, voiceNotes: 0 });
  assert.deepEqual(whereYouWent({ stats: none, destinations: ['Somewhere'] }, names), { count: 1, noun: 'place', items: [{ name: 'Somewhere' }] });
  assert.equal(whereYouWent({ stats: none, destinations: [] }, names), null);
});
