/**
 * Personal packing lists: the things you carry, kept as three reusable lists (short trip, long trip,
 * custom). Pure helpers here; storage lives in packingListsStore.ts.
 */
import { MAX_PACKING_ITEMS } from './packing';

export type PackingListId = 'short' | 'long' | 'custom';
export type PackingLists = Record<PackingListId, string[]>;

export const PACKING_LIST_IDS: PackingListId[] = ['short', 'long', 'custom'];
export const PACKING_LIST_NAMES: Record<PackingListId, string> = { short: 'Short trip', long: 'Long trip', custom: 'Custom' };

export const DEFAULT_PACKING_LISTS: PackingLists = {
  short: ['Phone charger', 'Power bank', 'ID card', 'Wallet', 'Toothbrush', 'Change of clothes', 'Water bottle', 'Medicines'],
  long: [
    'Phone charger', 'Power bank', 'ID card', 'Passport', 'Wallet', 'Toothbrush', 'Toiletries', 'Clothes for each day',
    'Jacket', 'Comfortable shoes', 'Water bottle', 'Medicines', 'First-aid kit', 'Sunscreen', 'Sunglasses', 'Laundry bag',
  ],
  custom: [],
};

export const labelKey = (label: string) => label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Adds a label once (ignoring case and spacing), up to the list limit. */
export function addToList(list: readonly string[], raw: string): string[] {
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!label || list.length >= MAX_PACKING_ITEMS) return [...list];
  if (list.some(l => labelKey(l) === labelKey(label))) return [...list];
  return [...list, label];
}

export function removeFromList(list: readonly string[], label: string): string[] {
  const k = labelKey(label);
  return list.filter(l => labelKey(l) !== k);
}

/** Reads stored lists defensively: anything missing or malformed falls back to the defaults. */
export function parseLists(raw: string | null | undefined): PackingLists {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const pick = (id: PackingListId) =>
      Array.isArray(v?.[id]) ? (v[id] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : DEFAULT_PACKING_LISTS[id];
    return { short: pick('short'), long: pick('long'), custom: pick('custom') };
  } catch {
    return { ...DEFAULT_PACKING_LISTS };
  }
}

/** The list a journey starts on: up to 4 days is a short trip. */
export function defaultListFor(startsOn: string | null, endsOn: string | null): PackingListId {
  if (!startsOn || !endsOn) return 'short';
  const days = Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 4 ? 'long' : 'short';
}

/**
 * What a journey's Pack tab shows for one personal list: each label with whether it's packed on
 * this trip, and the trip's own items that aren't on any personal list.
 */
export function packView<T extends { label: string; packed: number }>(lists: PackingLists, selected: PackingListId, tripItems: readonly T[]) {
  const byKey = new Map(tripItems.map(i => [labelKey(i.label), i]));
  const rows = lists[selected].map(label => ({ label, item: byKey.get(labelKey(label)) ?? null, packed: Boolean(byKey.get(labelKey(label))?.packed) }));
  const onLists = new Set(PACKING_LIST_IDS.flatMap(id => lists[id].map(labelKey)));
  const extras = tripItems.filter(i => !onLists.has(labelKey(i.label)));
  return { rows, extras };
}

/** Packed / total for a journey, counted against its chosen personal list plus its own extra items. */
export function packCounts<T extends { label: string; packed: number }>(lists: PackingLists, selected: PackingListId, tripItems: readonly T[]) {
  const { rows, extras } = packView(lists, selected, tripItems);
  return {
    done: rows.filter(r => r.packed).length + extras.filter(e => e.packed).length,
    total: rows.length + extras.length,
  };
}
