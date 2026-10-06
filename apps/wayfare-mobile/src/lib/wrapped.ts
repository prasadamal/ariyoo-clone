/** "Year in travel" summary (pure). */
import { getDestination } from '../content/destinations';
import { computeTravelStats, type StatsInput, type TravelStats } from './travelStats';
import { parseDay } from './format';

export type Persona = { title: string; blurb: string; icon: string };

export type WrappedSummary = {
  year: number;
  stats: TravelStats;
  topMood: string | null;
  topPlace: string | null;
  busiestMonth: string | null;
  destinations: string[];
  spendByCurrency: Record<string, number>;
  persona: Persona;
  highlights: string[];
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function mostCommon(values: (string | null | undefined)[]) {
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = v?.trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

export function personaFor(s: TravelStats): Persona {
  if (s.trips === 0) return { title: 'The Dreamer', blurb: 'This year was for planning. Next year, the trail.', icon: 'star-shooting-outline' };
  if (s.maxAltitudeM >= 4000) return { title: 'The Summit Seeker', blurb: 'Thin air and big views — you went high.', icon: 'image-filter-hdr' };
  if (s.km >= 200) return { title: 'The Long-Haul Wanderer', blurb: 'Kilometres stacked up behind you.', icon: 'routes' };
  if (s.destinations >= 4) return { title: 'The Explorer', blurb: 'New places, new stories, again and again.', icon: 'compass-rose' };
  if (s.entries >= 40) return { title: 'The Storyteller', blurb: 'You wrote it all down, so you will never forget.', icon: 'feather' };
  if (s.photos >= 80) return { title: 'The Light Chaser', blurb: 'Your camera roll is a travelogue.', icon: 'camera-iris' };
  return { title: 'The Weekend Wanderer', blurb: 'Small escapes, big memories.', icon: 'tent' };
}

function inYear(iso: string | null | undefined, year: number) {
  if (!iso) return false;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDay(iso) : new Date(iso);
  return !!d && d.getFullYear() === year;
}

export type DatedMedia = { at: string; audio: boolean };

export function buildWrapped(year: number, input: StatsInput, media: DatedMedia[] = []): WrappedSummary {
  const entries = input.entries.filter(e => inYear(e.recorded_at, year));
  const tripIds = new Set(entries.map(e => e.trip_id));
  const trips = input.trips.filter(t => tripIds.has(t.id) || inYear(t.starts_on, year) || inYear(t.ends_on, year));
  const tripIdSet = new Set(trips.map(t => t.id));
  const trackPointsByTrip: StatsInput['trackPointsByTrip'] = {};
  for (const [tripId, points] of Object.entries(input.trackPointsByTrip)) {
    const pts = points.filter(p => inYear(p.recorded_at, year));
    if (pts.length) trackPointsByTrip[tripId] = pts;
  }
  const expenses = (input.expenses ?? []).filter(
    e => tripIdSet.has(e.trip_id) && (!e.spent_on || inYear(e.spent_on, year))
  );
  const yearMedia = media.filter(m => inYear(m.at, year));
  const stats = computeTravelStats({
    trips,
    entries,
    expenses,
    trackPointsByTrip,
    photos: yearMedia.filter(m => !m.audio).length,
    voiceNotes: yearMedia.filter(m => m.audio).length,
  });

  const monthCounts = new Array(12).fill(0);
  for (const e of entries) monthCounts[new Date(e.recorded_at).getMonth()]++;
  const busiest = monthCounts.some(c => c > 0) ? MONTHS[monthCounts.indexOf(Math.max(...monthCounts))] : null;

  const spendByCurrency: Record<string, number> = {};
  for (const e of expenses) spendByCurrency[e.currency] = (spendByCurrency[e.currency] ?? 0) + e.amount;

  const destinations = Array.from(
    new Set(trips.map(t => getDestination(t.place_key)?.name ?? t.destination?.trim()).filter((x): x is string => !!x))
  );

  const highlights: string[] = [];
  if (stats.km >= 1) highlights.push(`${stats.km.toLocaleString('en-IN')} km on recorded routes`);
  if (stats.maxAltitudeM >= 1000) highlights.push(`Highest point: ${stats.maxAltitudeM.toLocaleString('en-IN')} m`);
  if (stats.elevationGainM >= 500) highlights.push(`${stats.elevationGainM.toLocaleString('en-IN')} m climbed`);
  if (stats.longestStreakDays >= 3) highlights.push(`${stats.longestStreakDays}-day journaling streak`);
  if (stats.countries >= 2) highlights.push(`${stats.countries} countries`);
  if (stats.longestTripDays >= 5) highlights.push(`Longest trip: ${stats.longestTripDays} days`);

  return {
    year,
    stats,
    topMood: mostCommon(entries.map(e => e.mood)),
    topPlace: mostCommon(entries.map(e => e.place_name)),
    busiestMonth: busiest,
    destinations,
    spendByCurrency,
    persona: personaFor(stats),
    highlights,
  };
}
