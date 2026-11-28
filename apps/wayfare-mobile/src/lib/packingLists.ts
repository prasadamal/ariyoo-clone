/**
 * Personal packing checklists: the things you carry, kept as reusable lists. Short trip and Long trip
 * come ready-made; you can add one of your own (Trek, Wedding, Work…), so three at most. Pure
 * helpers here; storage lives in packingListsStore.ts.
 */
import { MAX_PACKING_ITEMS } from './packing';

export type PackingList = { id: string; name: string; items: string[] };
export type PackingLists = PackingList[];

/** The two ready-made lists can't be deleted (they're the defaults for short and long journeys). */
export const BUILT_IN_LISTS = ['short', 'long'];
/** Short trip, Long trip and one list of your own. */
export const MAX_LISTS = 3;
/** A list's name, and an item on it, stay short enough to read at a glance. */
export const MAX_LIST_NAME = 24;
export const MAX_ITEM_LABEL = 60;

export const DEFAULT_PACKING_LISTS: PackingLists = [
  { id: 'short', name: 'Short trip', items: ['Phone charger', 'Power bank', 'ID card', 'Wallet', 'Toothbrush', 'Change of clothes', 'Water bottle', 'Medicines'] },
  {
    id: 'long',
    name: 'Long trip',
    items: [
      'Phone charger', 'Power bank', 'ID card', 'Passport', 'Wallet', 'Toothbrush', 'Toiletries', 'Clothes for each day',
      'Jacket', 'Comfortable shoes', 'Water bottle', 'Medicines', 'First-aid kit', 'Sunscreen', 'Sunglasses', 'Laundry bag',
    ],
  },
];

export const labelKey = (label: string) => label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Adds a label once (ignoring case and spacing), up to the list limit. */
export function addToList(list: readonly string[], raw: string): string[] {
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_ITEM_LABEL);
  if (!label || list.length >= MAX_PACKING_ITEMS) return [...list];
  if (list.some(l => labelKey(l) === labelKey(label))) return [...list];
  return [...list, label];
}

export function removeFromList(list: readonly string[], label: string): string[] {
  const k = labelKey(label);
  return list.filter(l => labelKey(l) !== k);
}

const cleanItems = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : null;

/**
 * Reads stored lists defensively. Understands the first format ({ short: [...], long: [...],
 * custom: [...] }) and the current one (an array of named lists); anything broken falls back to the
 * defaults, and the two built-in lists are always there.
 */
export function parseLists(raw: string | null | undefined): PackingLists {
  let v: unknown;
  try {
    v = raw ? JSON.parse(raw) : null;
  } catch {
    v = null;
  }
  let lists: PackingLists;
  if (Array.isArray(v)) {
    lists = v
      .filter((l): l is { id: unknown; name: unknown; items: unknown } => Boolean(l) && typeof l === 'object')
      .filter(l => typeof l.id === 'string' && typeof l.name === 'string' && l.name.trim().length > 0)
      .map(l => ({ id: l.id as string, name: (l.name as string).trim().slice(0, MAX_LIST_NAME), items: cleanItems(l.items) ?? [] }));
  } else if (v && typeof v === 'object') {
    // The first format: short, long and an optional custom list.
    const o = v as Record<string, unknown>;
    lists = DEFAULT_PACKING_LISTS.map(d => ({ ...d, items: cleanItems(o[d.id]) ?? d.items }));
    const custom = cleanItems(o.custom);
    if (custom?.length) lists.push({ id: 'custom', name: 'Custom', items: custom });
  } else {
    lists = DEFAULT_PACKING_LISTS.map(d => ({ ...d, items: [...d.items] }));
  }
  for (const d of DEFAULT_PACKING_LISTS.filter(x => BUILT_IN_LISTS.includes(x.id)).reverse()) {
    if (!lists.some(l => l.id === d.id)) lists.unshift({ ...d, items: [...d.items] });
  }
  const seen = new Set<string>();
  const unique = lists.filter(l => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  // One list of your own: the old empty "Custom" placeholder goes, and when an older version made
  // several lists, the first keeps the items of the others (nothing you typed is lost).
  const builtIns = BUILT_IN_LISTS.map(id => unique.find(l => l.id === id)).filter((l): l is PackingList => Boolean(l));
  const own = unique.filter(l => !BUILT_IN_LISTS.includes(l.id) && (l.items.length > 0 || l.id !== 'custom'));
  if (!own.length) return builtIns;
  const merged = own.slice(1).reduce((items, l) => l.items.reduce((acc, item) => addToList(acc, item), items), own[0].items.slice(0, MAX_PACKING_ITEMS));
  return [...builtIns, { ...own[0], items: merged }];
}

/** Why a name can't be used for a new list (null when it can). */
export function listNameProblem(lists: PackingLists, rawName: string): string | null {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) return 'Give the list a name.';
  if (name.length > MAX_LIST_NAME) return `Keep it to ${MAX_LIST_NAME} letters.`;
  if (lists.some(l => labelKey(l.name) === labelKey(name))) return 'You already have a list with that name.';
  if (lists.length >= MAX_LISTS) return 'You can have one list of your own. Delete it to make another.';
  return null;
}

/** A new, empty checklist. Returns the lists unchanged when the name can't be used or the cap is hit. */
export function addList(lists: PackingLists, rawName: string, id: string): PackingLists {
  const name = rawName.trim().replace(/\s+/g, ' ').slice(0, MAX_LIST_NAME);
  if (listNameProblem(lists, name)) return lists;
  return [...lists, { id, name, items: [] }];
}

export function deleteList(lists: PackingLists, id: string): PackingLists {
  return BUILT_IN_LISTS.includes(id) ? lists : lists.filter(l => l.id !== id);
}

export function updateItems(lists: PackingLists, id: string, items: string[]): PackingLists {
  return lists.map(l => (l.id === id ? { ...l, items } : l));
}

/** The list a journey starts on: up to 4 days is a short trip. */
export function defaultListFor(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn || !endsOn) return 'short';
  const days = Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 4 ? 'long' : 'short';
}

/** The chosen list, or Short trip if it was deleted. */
export function listOrDefault(lists: PackingLists, id: string): PackingList {
  return lists.find(l => l.id === id) ?? lists.find(l => l.id === 'short') ?? lists[0];
}

/**
 * What a journey's Pack view shows for one checklist: each item with whether it's packed on this
 * trip, and the trip's own items that aren't on any checklist.
 */
export function packView<T extends { label: string; packed: number }>(lists: PackingLists, selected: string, tripItems: readonly T[]) {
  const byKey = new Map(tripItems.map(i => [labelKey(i.label), i]));
  const rows = listOrDefault(lists, selected).items.map(label => ({ label, item: byKey.get(labelKey(label)) ?? null, packed: Boolean(byKey.get(labelKey(label))?.packed) }));
  const onLists = new Set(lists.flatMap(l => l.items.map(labelKey)));
  const extras = tripItems.filter(i => !onLists.has(labelKey(i.label)));
  return { rows, extras };
}

/** Packed / total for a journey, counted against its chosen checklist plus its own extra items. */
export function packCounts<T extends { label: string; packed: number }>(lists: PackingLists, selected: string, tripItems: readonly T[]) {
  const { rows, extras } = packView(lists, selected, tripItems);
  return {
    done: rows.filter(r => r.packed).length + extras.filter(e => e.packed).length,
    total: rows.length + extras.length,
  };
}
