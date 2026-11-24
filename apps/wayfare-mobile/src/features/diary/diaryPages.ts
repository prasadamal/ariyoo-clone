/** Diary pages: pure helpers (unit-tested). */

type Dated = { recorded_at: string };

/** Local calendar day "YYYY-MM-DD". */
export function dayOf(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type DiaryPage<T> = { day: string; entries: T[] };

/**
 * Today's page first (always, even when empty), then every earlier day that has writing, newest first.
 * Nothing from the future is shown: you can't write tomorrow's page.
 */
export function diaryPages<T extends Dated>(entries: T[], today: string): DiaryPage<T>[] {
  const byDay = new Map<string, T[]>();
  for (const e of entries) {
    const day = dayOf(e.recorded_at);
    if (day > today) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const past = [...byDay.keys()].filter(d => d !== today).sort((a, b) => b.localeCompare(a));
  return [{ day: today, entries: byDay.get(today) ?? [] }, ...past.map(day => ({ day, entries: byDay.get(day)! }))];
}

/** The page for a chosen date: that day if written, otherwise the nearest earlier day that was. */
export function pageIndexFor(pages: { day: string }[], day: string): { index: number; exact: boolean } {
  const exact = pages.findIndex(p => p.day === day);
  if (exact >= 0) return { index: exact, exact: true };
  const older = pages.findIndex(p => p.day < day);
  return { index: older >= 0 ? older : pages.length - 1, exact: false };
}

/**
 * One swipeable sheet of the diary. Today can have several pages (each its own entry, editable);
 * an earlier day is one read-only sheet holding everything written that day.
 */
export type DiarySheet<T> = {
  key: string;
  day: string;
  editable: boolean;
  /** Today's page: the entry it writes to (null while still blank). */
  entry: T | null;
  /** An earlier day: its entries. */
  entries: T[];
  page: number;
  pages: number;
};

/**
 * Sheets newest first: today's pages (latest page first), then earlier days. todayKeys lists today's
 * pages oldest → newest by key (an entry id, or "new-…" for a page not written yet).
 */
export function diarySheets<T extends Dated & { id: string }>(entries: T[], today: string, todayKeys: string[]): DiarySheet<T>[] {
  const byId = new Map(entries.map(e => [e.id, e]));
  const keys = todayKeys.length ? todayKeys : ['new-0'];
  const todaySheets: DiarySheet<T>[] = keys.map((key, i) => ({
    key,
    day: today,
    editable: true,
    entry: byId.get(key) ?? null,
    entries: [],
    page: i + 1,
    pages: keys.length,
  }));
  const past = diaryPages(entries, today)
    .slice(1)
    .map(p => ({ key: `day-${p.day}`, day: p.day, editable: false, entry: null, entries: p.entries, page: 1, pages: 1 }));
  return [...todaySheets.reverse(), ...past];
}

/** Today's page keys from today's own entries, oldest first (or one blank page). */
export function todayPageKeys<T extends Dated & { id: string }>(mine: T[], today: string): string[] {
  const keys = mine
    .filter(e => dayOf(e.recorded_at) === today)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map(e => e.id);
  return keys.length ? keys : ['new-0'];
}

/** Today's one page: the first thing written today (or a blank page). Older multi-page days keep their extra entries read-only. */
export function todayPageKey<T extends Dated & { id: string }>(mine: T[], today: string): string {
  return todayPageKeys(mine, today)[0];
}

/**
 * What a sideways drag on the diary does. Days run newest (index 0, today) to oldest. Dragging right
 * goes back in time, left comes toward today. A short or mostly-vertical drag stays on the page.
 */
export function swipeOutcome(dx: number, dy: number, index: number, count: number, threshold = 60): 'older' | 'newer' | 'stay' {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 'stay';
  if (dx > 0) return index < count - 1 ? 'older' : 'stay';
  return index > 0 ? 'newer' : 'stay';
}

/**
 * "Write anywhere": a tap on an empty ruled line below the writing moves the pen there. Returns how
 * many new lines to add so the cursor lands on the tapped line (0 when the tap is on the writing).
 */
export function linesToTap(tapY: number, contentHeight: number, lineHeight: number, maxLines = 40): number {
  if (!(lineHeight > 0) || !Number.isFinite(tapY) || !Number.isFinite(contentHeight) || tapY <= contentHeight) return 0;
  return Math.min(maxLines, Math.floor((tapY - contentHeight) / lineHeight) + 1);
}
