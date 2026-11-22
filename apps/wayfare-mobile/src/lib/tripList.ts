import { tripPhase } from './format';

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
