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
  for (const t of input.trips) {
    const key = t.place_key || t.destination?.trim().toLowerCase() || null;
    if (key) placeKeys.add(key);
    const d = getDestination(t.place_key);
    if (d) {
      countries.add(d.countryCode);
      states.add(d.region);
    }
  }
  for (const e of input.entries) {
    if (e.country_code) countries.add(e.country_code.toUpperCase());
    if (e.region) states.add(e.region.trim());
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
