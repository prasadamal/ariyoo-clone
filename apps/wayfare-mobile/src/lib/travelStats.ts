/** Aggregates the on-device journal into traveller stats (pure: feed it rows, get numbers). */
import { getDestination } from '../content/destinations';
import { elevationStats, haversineM, trackDistanceKm, type TrackPoint } from './geo';
import { dayCount, parseDay, toDayString } from './format';

export type StatsTrip = {
  id: string;
  title: string;
  destination: string | null;
  place_key: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
};

export type StatsEntry = {
  trip_id: string;
  recorded_at: string;
  mood: string | null;
  place_name: string | null;
  weather: string | null;
  region?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type StatsExpense = { trip_id: string; amount: number; currency: string; spent_on: string | null };

export type StatsInput = {
  trips: StatsTrip[];
  entries: StatsEntry[];
  expenses?: StatsExpense[];
  trackPointsByTrip: Record<string, TrackPoint[]>;
  photos: number;
  voiceNotes: number;
};

export type TravelStats = {
  trips: number;
  completedTrips: number;
  entries: number;
  photos: number;
  voiceNotes: number;
  km: number;
  /** Distance travelled: per journey, the longer of its recorded route and the path between located moments. */
  kmTravelled: number;
  maxAltitudeM: number;
  elevationGainM: number;
  destinations: number;
  countries: number;
  /** ISO codes of countries visited (catalog destinations and places looked up for moments), sorted. */
  countryCodes: string[];
  /** States / provinces visited, as "Kerala" (or "Kerala, IN" style keys collapsed to the name), sorted. */
  states: string[];
  /** States visited, grouped by country code (sorted); "" holds states whose country isn't known. */
  statesByCountry: Record<string, string[]>;
  /** Named places you went (a moment's place, a journey's destination), per "COUNTRY|State" key, sorted. */
  placesByRegion: Record<string, string[]>;
  longestTripDays: number;
  longestStreakDays: number;
  earlyBirdEntries: number;
  nightOwlEntries: number;
  snowEntries: number;
  rainEntries: number;
};

export function longestStreak(isoTimes: string[]) {
  const days = Array.from(new Set(isoTimes.map(t => toDayString(new Date(t))))).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const day of days) {
    const d = parseDay(day)!;
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function tripDays(trip: StatsTrip, entries: StatsEntry[]) {
  const planned = dayCount(trip.starts_on, trip.ends_on);
  if (planned) return planned;
  const days = new Set(entries.filter(e => e.trip_id === trip.id).map(e => toDayString(new Date(e.recorded_at))));
  return days.size;
}

export function computeTravelStats(input: StatsInput): TravelStats {
  let km = 0;
  let maxAlt = 0;
  let gain = 0;
  const routeKmByTrip: Record<string, number> = {};
  for (const [tripId, points] of Object.entries(input.trackPointsByTrip)) {
    if (points.length < 2) continue;
    const tripKm = trackDistanceKm(points);
    routeKmByTrip[tripId] = tripKm;
    km += tripKm;
    const elev = elevationStats(points);
    gain += elev.gainM;
    if (elev.maxM != null) maxAlt = Math.max(maxAlt, elev.maxM);
  }
  const placeKeys = new Set<string>();
  const countries = new Set<string>();
  const states = new Set<string>();
  const byCountry = new Map<string, Set<string>>();
  const addState = (country: string, state: string) => {
    if (!state) return;
    if (!byCountry.has(country)) byCountry.set(country, new Set());
    byCountry.get(country)!.add(state);
  };
  // Places under their state; the same place spelled with different case counts once.
  const places = new Map<string, Map<string, string>>();
  const addPlace = (country: string, state: string, place: string | null | undefined) => {
    const name = place?.trim();
    // "Goa" inside Goa or "Ladakh" inside Ladakh adds nothing: the state already says it.
    if (!state || !name || name.toLowerCase() === state.toLowerCase()) return;
    const key = `${country}|${state}`;
    if (!places.has(key)) places.set(key, new Map());
    const m = places.get(key)!;
    if (!m.has(name.toLowerCase())) m.set(name.toLowerCase(), name);
  };
  for (const t of input.trips) {
    const key = t.place_key || t.destination?.trim().toLowerCase() || null;
    if (key) placeKeys.add(key);
    const d = getDestination(t.place_key);
    if (d) {
      countries.add(d.countryCode);
      states.add(d.region);
      addState(d.countryCode, d.region);
      addPlace(d.countryCode, d.region, d.name);
    }
  }
  for (const e of input.entries) {
    if (e.country_code) countries.add(e.country_code.toUpperCase());
    if (e.region) states.add(e.region.trim());
    if (e.region) addState(e.country_code ? e.country_code.toUpperCase() : '', e.region.trim());
    if (e.region) addPlace(e.country_code ? e.country_code.toUpperCase() : '', e.region.trim(), e.place_name);
  }
  // Path between a journey's located moments, in time order (jumps under 50 m are GPS noise).
  const momentKmByTrip: Record<string, number> = {};
  const located = input.entries
    .filter(e => e.latitude != null && e.longitude != null)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const lastByTrip: Record<string, { latitude: number; longitude: number }> = {};
  for (const e of located) {
    const here = { latitude: e.latitude as number, longitude: e.longitude as number };
    const prev = lastByTrip[e.trip_id];
    if (prev) {
      const m = haversineM(prev, here);
      if (m >= 50) momentKmByTrip[e.trip_id] = (momentKmByTrip[e.trip_id] ?? 0) + m / 1000;
    }
    lastByTrip[e.trip_id] = here;
  }
  let kmTravelled = 0;
  for (const tripId of new Set([...Object.keys(routeKmByTrip), ...Object.keys(momentKmByTrip)])) {
    kmTravelled += Math.max(routeKmByTrip[tripId] ?? 0, momentKmByTrip[tripId] ?? 0);
  }

  let early = 0;
  let night = 0;
  let snow = 0;
  let rain = 0;
  for (const e of input.entries) {
    const h = new Date(e.recorded_at).getHours();
    if (h >= 4 && h < 6) early++;
    if (h >= 23 || h < 3) night++;
    const w = (e.weather ?? '').toLowerCase();
    if (w.includes('snow')) snow++;
    if (w.includes('rain') || w.includes('drizzle') || w.includes('shower')) rain++;
  }
  return {
    trips: input.trips.length,
    completedTrips: input.trips.filter(t => t.status === 'completed').length,
    entries: input.entries.length,
    photos: input.photos,
    voiceNotes: input.voiceNotes,
    km: Math.round(km * 10) / 10,
    kmTravelled: Math.round(kmTravelled * 10) / 10,
    maxAltitudeM: Math.round(maxAlt),
    elevationGainM: Math.round(gain),
    destinations: placeKeys.size,
    countries: countries.size,
    countryCodes: [...countries].sort(),
    states: [...states].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    statesByCountry: Object.fromEntries(
      [...byCountry].map(([c, set]) => [c, [...set].sort((a, b) => a.localeCompare(b))])
    ),
    placesByRegion: Object.fromEntries(
      [...places].map(([k, m]) => [k, [...m.values()].sort((a, b) => a.localeCompare(b))])
    ),
    longestTripDays: input.trips.reduce((m, t) => Math.max(m, tripDays(t, input.entries)), 0),
    longestStreakDays: longestStreak(input.entries.map(e => e.recorded_at)),
    earlyBirdEntries: early,
    nightOwlEntries: night,
    snowEntries: snow,
    rainEntries: rain,
  };
}

/** Money spent in a calendar year (by the day it was spent), per currency. */
export function spendInYear(expenses: StatsExpense[], year: number) {
  const out: { amount: number; currency: string }[] = [];
  for (const e of expenses) {
    const day = e.spent_on || '';
    if (day.slice(0, 4) === String(year) && e.amount > 0) out.push({ amount: e.amount, currency: e.currency });
  }
  return out;
}

/** A flag emoji for an ISO country code ("IN" → 🇮🇳). */
export function flagEmoji(code: string) {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️';
}

/** A readable country name, from the device's language data when available. */
export function countryName(code: string) {
  try {
    const names = new (Intl as any).DisplayNames(['en'], { type: 'region' });
    return names.of(code) || code;
  } catch {
    return code;
  }
}

/** What a country calls its first-level areas, so "6 states" in India and "3 provinces" in Sri Lanka. */
const STATE_WORD: Record<string, string> = {
  IN: 'state', US: 'state', AU: 'state', MY: 'state', MX: 'state', BR: 'state', DE: 'state', NG: 'state', AT: 'state',
  CA: 'province', LK: 'province', TH: 'province', VN: 'province', ID: 'province', NP: 'province', CN: 'province',
  PH: 'province', KH: 'province', LA: 'province', ZA: 'province', AR: 'province', IT: 'region', ES: 'region', FR: 'region',
  JP: 'prefecture', GB: 'nation', AE: 'emirate', CH: 'canton', KR: 'province', TR: 'province', PK: 'province',
};
export function stateWord(code: string, n: number) {
  const w = STATE_WORD[code.toUpperCase()] ?? 'region';
  return n === 1 ? w : `${w}s`;
}

/** Places you went in one country: its states (with the places in each) and how many places in all. */
export function countryPlaces(stats: Pick<TravelStats, 'statesByCountry' | 'placesByRegion'>, code: string) {
  const states = (stats.statesByCountry[code] ?? []).map(name => ({ name, places: stats.placesByRegion[`${code}|${name}`] ?? [] }));
  return { states, placeCount: states.reduce((n, s) => n + s.places.length, 0) };
}

/** "6 states · 24 places" (whichever parts there are). */
export function countrySummary(code: string, stateCount: number, placeCount: number) {
  const parts: string[] = [];
  if (stateCount) parts.push(`${stateCount} ${stateWord(code || 'XX', stateCount)}`);
  if (placeCount) parts.push(`${placeCount} ${placeCount === 1 ? 'place' : 'places'}`);
  return parts.join(' · ') || 'Visited';
}
