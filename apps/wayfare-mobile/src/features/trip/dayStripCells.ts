/**
 * The cells of a journey's sideways day scroller: one per day of the trip (Day 1, Day 2…), plus a
 * "Before" / "After" cell when moments were written outside the trip dates. Pure, so it's testable.
 */
export type DayCell = {
  /** The day to jump to (YYYY-MM-DD). For Before/After, the nearest day that has moments. */
  day: string;
  kind: 'before' | 'day' | 'after';
  /** Day number within the trip (kind "day"). */
  n: number | null;
  hasMoments: boolean;
};

/** A cap so a mistyped end date can't build thousands of cells. */
export const MAX_STRIP_DAYS = 120;

const addDays = (day: string, k: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + k);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

/**
 * startsOn/endsOn: the journey's dates (either may be missing). momentDays: days that have moments.
 * Returns [] when there is only one day to show — the scroller is hidden then.
 */
export function dayStripCells(startsOn: string | null, endsOn: string | null, momentDays: readonly string[]): DayCell[] {
  const moments = [...new Set(momentDays)].sort();
  const start = startsOn ?? moments[0] ?? null;
  if (!start) return [];
  let end = endsOn && endsOn >= start ? endsOn : null;
  // No end date: run to the last moment written during the trip.
  if (!end) end = moments.filter(d => d >= start).pop() ?? start;
  const span = Math.min(between(start, end) + 1, MAX_STRIP_DAYS);
  if (span <= 1) return [];
  const has = new Set(moments);
  const cells: DayCell[] = [];
  const before = moments.filter(d => d < start);
  if (before.length) cells.push({ day: before[before.length - 1], kind: 'before', n: null, hasMoments: true });
  for (let i = 0; i < span; i++) {
    const day = addDays(start, i);
    cells.push({ day, kind: 'day', n: i + 1, hasMoments: has.has(day) });
  }
  const lastDay = addDays(start, span - 1);
  const after = moments.filter(d => d > lastDay);
  if (after.length) cells.push({ day: after[0], kind: 'after', n: null, hasMoments: true });
  return cells;
}

export type DatePill = { day: string; label: string };

/**
 * The date pills above a journey's moments: every day of the trip plus any other day that has
 * moments, in date order, labelled "Day 2 · 23 Nov" inside the trip and "20 Nov" outside it.
 * Empty when there's only one day (no need to switch).
 */
export function datePills(startsOn: string | null, endsOn: string | null, momentDays: readonly string[]): DatePill[] {
  const days = new Set(momentDays);
  const start = startsOn;
  const end = startsOn && endsOn && endsOn >= startsOn ? endsOn : startsOn;
  if (start && end) {
    const span = Math.min(between(start, end) + 1, MAX_STRIP_DAYS);
    for (let i = 0; i < span; i++) days.add(addDays(start, i));
  }
  const sorted = [...days].sort();
  if (sorted.length <= 1) return [];
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return sorted.map(day => {
    const n = start && end && day >= start && day <= end ? between(start, day) + 1 : null;
    return { day, label: n ? `Day ${n} · ${short(day)}` : short(day) };
  });
}
