/** People's names: capitalised as typed, shortened where space is tight. Pure (unit-tested). */

/**
 * Capitalise the first letter of every word while typing, leaving the rest as typed:
 * "amal prasad, joe" → "Amal Prasad, Joe". Works for comma-separated lists too.
 */
export function capitalizeWords(text: string): string {
  return text.replace(/(^|[\s,;])(\p{Ll})/gu, (_m, before: string, letter: string) => before + letter.toLocaleUpperCase());
}

/** A tidy name: single spaces, every word capitalised. */
export function capitalizeName(name: string): string {
  return capitalizeWords(name.trim().replace(/\s+/g, ' '));
}

/** Just the first name, cut to `max` characters with an ellipsis: for chips and tight rows. */
export function firstName(name: string, max = 12): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}
