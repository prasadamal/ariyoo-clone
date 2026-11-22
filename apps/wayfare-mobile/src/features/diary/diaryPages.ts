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
