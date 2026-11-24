/** "Add photos from these dates" (pure, unit-tested): which gallery photos belong to a journey, by day. */
import { tripDayLabel } from '../features/trip/dayStripCells';
import { toDayString } from './format';

export type GalleryPhoto = { id: string; uri: string; creationTime: number; width?: number; height?: number };

/** The journey's days as a time window on this phone's clock: start 00:00 to the day after the end. */
export function galleryWindow(startsOn: string, endsOn: string | null): { after: number; before: number } | null {
  const [y, m, d] = startsOn.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const end = endsOn && endsOn >= startsOn ? endsOn : startsOn;
  const [ey, em, ed] = end.slice(0, 10).split('-').map(Number);
  return { after: new Date(y, m - 1, d).getTime(), before: new Date(ey, em - 1, ed + 1).getTime() };
}

/** Photos not added before and taken after the last "Not now" (so new photos bring the card back). */
export function newPhotos(photos: GalleryPhoto[], added: ReadonlySet<string>, snoozedUntil = 0): GalleryPhoto[] {
  return photos.filter(p => !added.has(p.id)).filter(p => p.creationTime > snoozedUntil);
}

/** Photos grouped into the journey's days (Day 1, Day 2…), oldest first within each day. */
export function photosByDay(photos: GalleryPhoto[], startsOn: string, endsOn: string | null) {
  const byDay = new Map<string, GalleryPhoto[]>();
  for (const p of [...photos].sort((a, b) => a.creationTime - b.creationTime)) {
    const day = toDayString(new Date(p.creationTime));
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const days = [...byDay.keys()].sort();
  return days.map(day => ({ day, label: tripDayLabel(day, startsOn, endsOn, days), photos: byDay.get(day)! }));
}

/** "Day 1–3", "Day 2" or "3 days" for the add button. */
export function daysLabel(labels: string[]) {
  const nums = labels.map(l => /^Day (\d+)$/.exec(l)?.[1]).filter(Boolean).map(Number);
  if (nums.length === labels.length && nums.length) {
    const lo = Math.min(...nums), hi = Math.max(...nums);
    return lo === hi ? `Day ${lo}` : `Day ${lo}–${hi}`;
  }
  return `${labels.length} ${labels.length === 1 ? 'day' : 'days'}`;
}
