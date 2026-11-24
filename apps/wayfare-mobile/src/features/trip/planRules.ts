import type { LocalItineraryItem } from '../../lib/localDb';

/** Quick times in the plan sheet (24-hour). */
export const QUICK_TIMES = [
  { label: 'Morning', time: '09:00' },
  { label: 'Afternoon', time: '14:00' },
  { label: 'Evening', time: '19:00' },
];

/** A day's plans in the order of the day: timed ones by time, then the rest as they were added. */
export function sortPlan<T extends Pick<LocalItineraryItem, 'start_time' | 'sort_order'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time) || a.sort_order - b.sort_order;
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return a.sort_order - b.sort_order;
  });
}
