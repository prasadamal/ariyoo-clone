/** Mood calendar and writing streak for the diary. Pure, so it's testable. */
import { dayOf } from './diaryPages';

type Written = { recorded_at: string; mood?: string | null; body?: string | null };

const addDays = (day: string, k: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + k);
  return dayOf(d);
};

/** Days in a row with something written, ending today (or yesterday, so today isn't a broken streak yet). */
export function writingStreak(entries: Written[], today: string): number {
  const days = new Set(entries.map(e => dayOf(e.recorded_at)));
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export type CalendarDay = { day: string | null; date: number | null; emoji: string | null; written: boolean; future: boolean };

/**
 * A month as weeks (Monday first) for the mood calendar: each day's first mood emoji, whether
 * anything was written, and whether it's still to come.
 */
export function monthGrid(year: number, month: number, entries: Written[], today: string): CalendarDay[][] {
  const byDay = new Map<string, { emoji: string | null }>();
  for (const e of [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))) {
    const d = dayOf(e.recorded_at);
    const prev = byDay.get(d);
    const emoji = e.mood ? e.mood.split(' ')[0] : null;
    byDay.set(d, { emoji: prev?.emoji ?? emoji });
  }
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: CalendarDay[] = Array.from({ length: lead }, () => ({ day: null, date: null, emoji: null, written: false, future: false }));
  for (let d = 1; d <= daysIn; d++) {
    const day = dayOf(new Date(year, month, d, 12));
    const hit = byDay.get(day);
    cells.push({ day, date: d, emoji: hit?.emoji ?? null, written: Boolean(hit), future: day > today });
  }
  while (cells.length % 7) cells.push({ day: null, date: null, emoji: null, written: false, future: false });
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
