/** Packing-list helpers that need no database, so they can be tested on their own. */

export const MAX_PACKING_ITEMS = 300;

const key = (label: string) => label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Labels from another trip to add to this one: trimmed, without blanks, without anything this
 * trip already has (ignoring case and spacing), each once, in the source order, and never past
 * the list limit.
 */
export function labelsToCopy(existing: readonly string[], incoming: readonly string[]): string[] {
  const seen = new Set(existing.map(key));
  const out: string[] = [];
  for (const raw of incoming) {
    const label = raw.trim().replace(/\s+/g, ' ');
    const k = key(label);
    if (!label || seen.has(k)) continue;
    if (existing.length + out.length >= MAX_PACKING_ITEMS) break;
    seen.add(k);
    out.push(label.slice(0, 120));
  }
  return out;
}
