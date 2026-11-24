import { daysUntil, tripPhase } from './format';

/** Pure helpers for the Journeys list (unit-tested). */

export type TripFilter = 'all' | 'upcoming' | 'past';

type TripLike = { id: string; status: string; starts_on: string | null; ends_on: string | null };

/** The journey to show on top: on the road now, or the next one coming up (soonest first). */
export function pickNextUp<T extends TripLike>(trips: T[], today = new Date()): T | null {
  const candidates = trips
    .filter(t => t.status !== 'completed' && ['upcoming', 'ongoing'].includes(tripPhase(t.starts_on, t.ends_on, today)))
    .sort((a, b) => (a.starts_on ?? '').localeCompare(b.starts_on ?? ''));
  return candidates[0] ?? null;
}

/** The list under it: never the one already shown on top, then the chosen filter. */
export function applyTripFilter<T extends TripLike>(trips: T[], filter: TripFilter, nextUpId: string | null, today = new Date()): T[] {
  const rest = nextUpId ? trips.filter(t => t.id !== nextUpId) : trips;
  if (filter === 'all') return rest;
  return rest.filter(t => {
    const phase = tripPhase(t.starts_on, t.ends_on, today);
    if (filter === 'upcoming') return t.status !== 'completed' && phase !== 'past';
    return t.status === 'completed' || phase === 'past';
  });
}

export type TripStatus = 'ongoing' | 'upcoming' | 'completed';
type DatedTrip = TripLike & { updated_at?: string | null };

/** On the road, coming up (dated or still a plan), or done. */
export function tripStatus(t: TripLike, today = new Date()): TripStatus {
  if (t.status === 'completed') return 'completed';
  const phase = tripPhase(t.starts_on, t.ends_on, today);
  if (phase === 'ongoing') return 'ongoing';
  if (phase === 'past') return 'completed';
  return 'upcoming';
}

/**
 * The three tiles on top of Journeys: the journey you're on, the next one coming up (dated ones
 * before undated plans) and the one that ended most recently. Any of them may be missing.
 */
export function featuredTrips<T extends DatedTrip>(trips: T[], today = new Date()) {
  const by = (s: TripStatus) => trips.filter(t => tripStatus(t, today) === s);
  const ongoing = by('ongoing').sort((a, b) => (a.starts_on ?? '').localeCompare(b.starts_on ?? ''))[0] ?? null;
  const upcoming =
    by('upcoming').sort((a, b) => {
      if (!a.starts_on !== !b.starts_on) return a.starts_on ? -1 : 1;
      return (a.starts_on ?? a.updated_at ?? '').localeCompare(b.starts_on ?? b.updated_at ?? '');
    })[0] ?? null;
  const completed = by('completed').sort((a, b) => (b.ends_on ?? b.starts_on ?? '').localeCompare(a.ends_on ?? a.starts_on ?? ''))[0] ?? null;
  return { ongoing, upcoming, completed };
}

/** Every journey, most recent first (by start date; undated plans by when they were last edited). */
export function recentFirst<T extends DatedTrip>(trips: T[]): T[] {
  const key = (t: T) => t.starts_on ?? (t.updated_at ?? '').slice(0, 10);
  return [...trips].sort((a, b) => key(b).localeCompare(key(a)));
}

/** How many journeys are in each group (the featured tiles show a stack when there's more than one). */
export function statusCounts<T extends TripLike>(trips: T[], today = new Date()): Record<TripStatus, number> {
  const out: Record<TripStatus, number> = { ongoing: 0, upcoming: 0, completed: 0 };
  for (const t of trips) out[tripStatus(t, today)]++;
  return out;
}

/** One group's journeys, as its list shows them: on the road and coming up soonest first, finished newest first. */
export function statusTrips<T extends DatedTrip>(trips: T[], status: TripStatus, today = new Date()): T[] {
  const list = trips.filter(t => tripStatus(t, today) === status);
  if (status === 'completed') return list.sort((a, b) => (b.ends_on ?? b.starts_on ?? '').localeCompare(a.ends_on ?? a.starts_on ?? ''));
  return list.sort((a, b) => {
    if (!a.starts_on !== !b.starts_on) return a.starts_on ? -1 : 1;
    return (a.starts_on ?? a.updated_at ?? '').localeCompare(b.starts_on ?? b.updated_at ?? '');
  });
}

/**
 * The big number on the right of every journey tile: days to go, the day you're on, or how long
 * the trip was. Always something, also for journeys without dates or marked complete early.
 */
export function tileCount(t: TripLike, today = new Date()): { value: string; caption: string } {
  const status = tripStatus(t, today);
  const until = daysUntil(t.starts_on, today);
  const length = t.starts_on ? (t.ends_on ? Math.max(1, (daysUntil(t.ends_on, today) ?? 0) - (until ?? 0) + 1) : 1) : null;
  if (status === 'upcoming') {
    if (until == null) return { value: '–', caption: 'no dates yet' };
    if (until <= 0) return { value: 'Today', caption: 'starts' };
    return { value: String(until), caption: `day${until === 1 ? '' : 's'} to go` };
  }
  if (status === 'ongoing') {
    if (until == null) return { value: 'Now', caption: 'on the road' };
    const day = -until + 1;
    return { value: `Day ${day}`, caption: t.ends_on && length ? `of ${length}` : 'on the road' };
  }
  if (length) return { value: String(length), caption: 'day trip' };
  return { value: '✓', caption: 'completed' };
}
