// Pure helpers for the everyday journal and "On this day". No database or React here, so they test alone.

/** Trip type of the private, built-in journal for days that are not part of a journey. */
export const EVERYDAY_TRIP_TYPE = 'everyday';

export function isEverydayTrip(trip: { trip_type: string }): boolean {
  return trip.trip_type === EVERYDAY_TRIP_TYPE;
}

/** Real journeys only: the everyday journal never shows up as a trip, in stats or in matching. */
export function journeysOnly<T extends { trip_type: string }>(trips: T[]): T[] {
  return trips.filter(t => !isEverydayTrip(t));
}

export type MemoryEntry = { id: string; trip_id: string; recorded_at: string; body: string | null; mood: string | null; place_name: string | null };
export type MemoryGroup<E extends MemoryEntry> = { yearsAgo: number; year: number; entries: E[] };

const localParts = (iso: string) => {
  const d = new Date(iso);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
};

/**
 * Entries written on today's calendar date in earlier years, newest year first, each year's entries
 * in the order they were written. 29 February memories show on 28 February in other years, so they
 * are not lost for three years out of four.
 */
export function onThisDay<E extends MemoryEntry>(entries: E[], today: Date): MemoryGroup<E>[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const byYear = new Map<number, E[]>();
  for (const e of entries) {
    const p = localParts(e.recorded_at);
    if (Number.isNaN(p.year) || p.year >= year) continue;
    const sameDay = p.month === month && p.day === day;
    const leapCarry = month === 1 && day === 28 && !isLeap(year) && p.month === 1 && p.day === 29;
    if (!sameDay && !leapCarry) continue;
    (byYear.get(p.year) ?? byYear.set(p.year, []).get(p.year)!).push(e);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, list]) => ({
      year: y,
      yearsAgo: year - y,
      entries: [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
    }));
}

/** "1 year ago", "3 years ago". */
export function yearsAgoLabel(n: number): string {
  return n === 1 ? '1 year ago' : `${n} years ago`;
}

/** Whether an entry was already written today (local time), to switch the home prompt to "Add more". */
export function wroteToday(entries: { recorded_at: string }[], today: Date): boolean {
  return entries.some(e => {
    const p = localParts(e.recorded_at);
    return p.year === today.getFullYear() && p.month === today.getMonth() && p.day === today.getDate();
  });
}
