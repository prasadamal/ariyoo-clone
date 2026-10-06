/** Place keys: the shared identity that lets travellers heading to the same place find each other. */
import { DESTINATIONS, type Destination, type DestinationKind } from '../content/destinations';

const GENERIC_WORDS =
  /\b(trek|treks|trekking|trip|tour|journey|vacation|holiday|holidays|travel|weekend|getaway|expedition|backpacking|road trip|roadtrip|visit|the)\b/g;

/** URL-safe slug: lowercase ascii, words joined by "-", max 60 chars. */
export function slugify(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function core(text: string) {
  return slugify(text.toLowerCase().replace(GENERIC_WORDS, ' '));
}

const INDEX: Map<string, Destination> = (() => {
  const map = new Map<string, Destination>();
  for (const d of DESTINATIONS) {
    map.set(d.key, d);
    map.set(core(d.name), d);
    for (const a of d.aliases ?? []) map.set(slugify(a), d);
  }
  return map;
})();

/** Finds a catalog destination from free text ("Kedarkantha Trek", "Leh", "EBC"…). */
export function matchDestination(text: string | null | undefined): Destination | undefined {
  if (!text?.trim()) return undefined;
  const direct = INDEX.get(slugify(text)) ?? INDEX.get(core(text));
  if (direct) return direct;
  // "Manali, Himachal" → try each comma/slash separated part.
  for (const part of text.split(/[,/|·–-]+/)) {
    const hit = INDEX.get(slugify(part)) ?? INDEX.get(core(part));
    if (hit) return hit;
  }
  return undefined;
}

/** Canonical place key for any destination text (catalog key when known). */
export function placeKeyFor(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const known = matchDestination(text);
  if (known) return known.key;
  const key = core(text.split(',')[0]) || slugify(text);
  return key.length >= 2 ? key : null;
}

export function isValidPlaceKey(key: string | null | undefined) {
  return !!key && /^[a-z0-9-]{2,60}$/.test(key);
}

/** Human label for a place key (catalog name, else Title Cased key). */
export function placeLabel(key: string | null | undefined, fallback?: string | null) {
  if (!key) return fallback ?? '';
  const d = INDEX.get(key);
  if (d) return d.name;
  if (fallback) return fallback;
  return key
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export type DestinationFilter = {
  query?: string;
  kind?: DestinationKind | null;
  month?: number | null;
  country?: string | null;
};

function score(d: Destination, q: string) {
  const name = d.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if ((d.aliases ?? []).some(a => a.replace(/-/g, ' ').startsWith(q))) return 70;
  if (name.includes(q)) return 60;
  if (d.region.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)) return 40;
  if (d.highlights.some(h => h.toLowerCase().includes(q)) || d.tagline.toLowerCase().includes(q)) return 20;
  return 0;
}

export function searchDestinations(filter: DestinationFilter = {}): Destination[] {
  const q = filter.query?.trim().toLowerCase() ?? '';
  return DESTINATIONS.map(d => ({ d, s: q ? score(d, q) : 1 }))
    .filter(({ d, s }) => {
      if (s <= 0) return false;
      if (filter.kind && !d.kinds.includes(filter.kind)) return false;
      if (filter.month && !d.bestMonths.includes(filter.month)) return false;
      if (filter.country && d.country !== filter.country) return false;
      return true;
    })
    .sort((a, b) => b.s - a.s || a.d.name.localeCompare(b.d.name))
    .map(({ d }) => d);
}

/** Destinations in their best season for a month (1–12), treks first. */
export function inSeason(month: number) {
  return DESTINATIONS.filter(d => d.bestMonths.includes(month)).sort(
    (a, b) => Number(b.kinds.includes('trek')) - Number(a.kinds.includes('trek')) || a.name.localeCompare(b.name)
  );
}

export function countriesInCatalog() {
  return Array.from(new Set(DESTINATIONS.map(d => d.country)));
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
