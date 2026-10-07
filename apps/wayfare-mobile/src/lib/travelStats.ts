/** Aggregates the on-device journal into traveller stats (pure: feed it rows, get numbers). */
import { getDestination } from '../content/destinations';
import { elevationStats, trackDistanceKm, type TrackPoint } from './geo';
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
  maxAltitudeM: number;
  elevationGainM: number;
  destinations: number;
  countries: number;
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
  for (const points of Object.values(input.trackPointsByTrip)) {
    if (points.length < 2) continue;
    km += trackDistanceKm(points);
    const elev = elevationStats(points);
    gain += elev.gainM;
    if (elev.maxM != null) maxAlt = Math.max(maxAlt, elev.maxM);
  }
  const placeKeys = new Set<string>();
  const countries = new Set<string>();
  for (const t of input.trips) {
    const key = t.place_key || t.destination?.trim().toLowerCase() || null;
    if (key) placeKeys.add(key);
    const d = getDestination(t.place_key);
    if (d) countries.add(d.countryCode);
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
    maxAltitudeM: Math.round(maxAlt),
    elevationGainM: Math.round(gain),
    destinations: placeKeys.size,
    countries: countries.size,
    longestTripDays: input.trips.reduce((m, t) => Math.max(m, tripDays(t, input.entries)), 0),
    longestStreakDays: longestStreak(input.entries.map(e => e.recorded_at)),
    earlyBirdEntries: early,
    nightOwlEntries: night,
    snowEntries: snow,
    rainEntries: rain,
  };
}
