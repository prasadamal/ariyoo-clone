import { stripRich } from './richText';

/** Searching your own journal (moments and journeys), on the phone. Pure, so it's testable. */
type Entry = { id: string; trip_id: string; recorded_at: string; body: string | null; place_name?: string | null; mood?: string | null };
type Trip = { id: string; title: string; destination?: string | null; trip_type: string };

export type SearchHit =
  | { kind: 'trip'; id: string; title: string; detail: string }
  | { kind: 'moment'; id: string; tripId: string; tripTitle: string; snippet: string; at: string };

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

/** A short piece of text around the first match, with … where it was cut. */
export function snippet(text: string, query: string, radius = 40) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = norm(flat).indexOf(norm(query));
  if (at < 0) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? '…' : '');
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

/** Every word in the query must appear (in the text, place or mood). Newest moments first. */
export function searchJournal(entries: Entry[], trips: Trip[], query: string, limit = 60): SearchHit[] {
  const words = norm(query).split(/\s+/).filter(w => w.length >= 2);
  if (!words.length) return [];
  const has = (hay: string) => words.every(w => hay.includes(w));
  const tripById = new Map(trips.map(t => [t.id, t]));
  const tripHits: SearchHit[] = trips
    .filter(t => t.trip_type !== 'everyday' && has(norm(`${t.title} ${t.destination ?? ''}`)))
    .map(t => ({ kind: 'trip', id: t.id, title: t.title, detail: t.destination ?? '' }));
  const momentHits: SearchHit[] = entries
    .filter(e => {
      const body = e.body && e.body !== '📷' ? stripRich(e.body) : '';
      return has(norm(`${body} ${e.place_name ?? ''} ${e.mood ?? ''}`));
    })
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .map(e => {
      const body = e.body && e.body !== '📷' ? stripRich(e.body) : '';
      const trip = tripById.get(e.trip_id);
      return {
        kind: 'moment' as const,
        id: e.id,
        tripId: e.trip_id,
        tripTitle: trip ? (trip.trip_type === 'everyday' ? 'Diary' : trip.title) : '',
        snippet: snippet(body || e.place_name || e.mood || '', words[0]),
        at: e.recorded_at,
      };
    });
  return [...tripHits, ...momentHits].slice(0, limit);
}
