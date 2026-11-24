/** Passport stamps: one per country, dated with the first visit (pure, unit-tested). */
import { getDestination } from '../content/destinations';
import { toDayString } from './format';
import type { StatsEntry, StatsTrip } from './travelStats';

export type PassportStamp = {
  code: string;
  /** First day you were there ("YYYY-MM-DD"), or the planned start for a country you haven't reached yet. */
  firstDay: string;
  /** States / provinces you've been to there. */
  states: number;
  /** Only in an upcoming journey so far: drawn faded. */
  upcoming: boolean;
};

/**
 * A country counts from a moment written there (its own country), or a journey whose destination
 * is in it that has started. A journey that hasn't started yet gives a faded "upcoming" stamp.
 */
export function passportStamps(trips: StatsTrip[], entries: StatsEntry[], today = toDayString(new Date())): PassportStamp[] {
  const seen = new Map<string, { firstDay: string; states: Set<string>; upcoming: boolean }>();
  const note = (code: string, day: string, upcoming: boolean, state?: string | null) => {
    const c = code.toUpperCase();
    const cur = seen.get(c);
    if (!cur) seen.set(c, { firstDay: day, states: new Set(state ? [state] : []), upcoming });
    else {
      if (cur.upcoming && !upcoming) {
        cur.upcoming = false;
        cur.firstDay = day;
      } else if (cur.upcoming === upcoming && day < cur.firstDay) cur.firstDay = day;
      if (state) cur.states.add(state);
    }
  };
  for (const e of entries) {
    if (!e.country_code) continue;
    const day = toDayString(new Date(e.recorded_at));
    note(e.country_code, day, day > today, e.region?.trim() || null);
  }
  for (const t of trips) {
    const d = getDestination(t.place_key);
    if (!d || !t.starts_on) continue;
    const started = t.starts_on.slice(0, 10) <= today;
    note(d.countryCode, t.starts_on.slice(0, 10), !started, started ? d.region : null);
  }
  return [...seen.entries()]
    .map(([code, v]) => ({ code, firstDay: v.firstDay, states: v.states.size, upcoming: v.upcoming }))
    .sort((a, b) => Number(a.upcoming) - Number(b.upcoming) || a.firstDay.localeCompare(b.firstDay) || a.code.localeCompare(b.code));
}

/** "NOV 2025" for a stamp. */
export function stampMonth(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();
}

/** A small, stable tilt for each stamp (-4°…4°), so the page looks hand-stamped but never jumps around. */
export function stampTilt(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 9) - 4;
}
