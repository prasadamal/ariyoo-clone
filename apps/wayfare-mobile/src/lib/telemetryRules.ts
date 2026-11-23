/** Pure rules for usage counts and crash reports (unit-tested); sending lives in telemetry.ts. */

export type QueuedEvent = { kind: 'event' | 'error'; name: string; detail: string | null; at: string };

/** The only usage events the app ever sends: counts, never content. */
export const USAGE_EVENTS = ['app_open', 'trip_created', 'moment_added', 'diary_written', 'expense_added', 'invite_sent', 'invite_joined', 'recap_shared'] as const;
export type UsageEvent = (typeof USAGE_EVENTS)[number];

export const MAX_QUEUE = 100;

/**
 * Strips anything personal from an error text before it leaves the phone: emails, long numbers,
 * file paths with names in them, URLs' query strings. Keeps it short.
 */
export function scrubDetail(text: string | null | undefined, max = 1500): string | null {
  if (!text) return null;
  const out = String(text)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b\d{6,}\b/g, '<number>')
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/g, '$1?…')
    .replace(/file:\/\/\S+/g, '<file>')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>');
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/** Adds to the waiting list; the oldest drop off past the cap so storage never grows forever. */
export function enqueue(queue: QueuedEvent[], e: QueuedEvent): QueuedEvent[] {
  const next = [...queue, e];
  return next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next;
}

/** "app_open" is counted once per device per day; other events every time. */
export function shouldCount(name: string, lastOpenDay: string | null, today: string): boolean {
  return name !== 'app_open' || lastOpenDay !== today;
}
