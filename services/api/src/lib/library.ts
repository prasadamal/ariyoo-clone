/**
 * Helpers for a member's personal answer library: search across their own conversations and the
 * answers they saved. Pure functions, tested alone.
 */

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
export const SEARCH_LIMIT = 40;
export const SAVED_LIMIT = 1000;

/**
 * Normalises what someone typed. LIKE wildcards and backslashes are replaced with spaces so a
 * search for "50%" or "a_b" matches text, not patterns. Returns null when too short to be useful.
 */
export function cleanQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const q = raw.replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX);
  return q.length >= SEARCH_MIN ? q : null;
}

/**
 * A short excerpt around the first match, with an ellipsis where text was cut, so a long answer
 * still shows the part that matched. Falls back to the start when the match is not in the text.
 */
export function snippetAround(text: string, query: string, radius = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = query ? flat.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (flat.length <= radius * 2 + query.length) return flat;
  if (at < 0) return flat.slice(0, radius * 2).trimEnd() + '…';
  let start = Math.max(0, at - radius);
  let end = Math.min(flat.length, at + query.length + radius);
  // Prefer whole words at the edges.
  if (start > 0) {
    const space = flat.indexOf(' ', start);
    if (space > -1 && space < at) start = space + 1;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(' ', end);
    if (space > at + query.length) end = space;
  }
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
}
