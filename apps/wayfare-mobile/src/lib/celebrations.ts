/**
 * When to celebrate (pure): a badge reaching a new level, or a country stamped for the first time.
 * What was already seen is stored on the phone; the first look only records it, so nobody gets
 * confetti for everything they had before the update.
 */

export type BadgeLevel = { id: string; level: number; title: string };

/** id → level, for badges that have a level. */
export function badgeLevels(badges: BadgeLevel[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of badges) if (b.level > 0) out[b.id] = b.level;
  return out;
}

/** Badges whose level went up since `seen` (null: never looked before, so nothing is new). */
export function newBadgeLevels(seen: Record<string, number> | null, badges: BadgeLevel[]): BadgeLevel[] {
  if (!seen) return [];
  return badges.filter(b => b.level > 0 && b.level > (seen[b.id] ?? 0));
}

/** The words for a toast about new badges. */
export function badgeToast(fresh: BadgeLevel[]): string | null {
  if (!fresh.length) return null;
  if (fresh.length === 1) return `New badge: ${fresh[0].title}`;
  return `${fresh.length} new badges: ${fresh.map(b => b.title).join(', ')}`;
}

/**
 * Countries to stamp with a landing animation: visited ones not seen before. The very first visit
 * to the passport lands every stamp once (it's the first time you see them).
 */
export function newStampCodes(seen: string[] | null, stamps: { code: string; upcoming: boolean }[]): string[] {
  const visited = stamps.filter(s => !s.upcoming).map(s => s.code);
  if (!seen) return visited;
  const known = new Set(seen);
  return visited.filter(c => !known.has(c));
}

/** Delay before a stamp lands, so several land one after another (capped, so a long list doesn't drag). */
export function stampDelay(index: number): number {
  return Math.min(index, 8) * 140;
}

/** Parses a stored value written by this module; anything unexpected reads as "never seen". */
export function parseSeen<T>(raw: string | null, check: (v: unknown) => v is T): T | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return check(v) ? v : null;
  } catch {
    return null;
  }
}

export const isLevelMap = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every(n => typeof n === 'number');

export const isCodeList = (v: unknown): v is string[] => Array.isArray(v) && v.every(c => typeof c === 'string');
