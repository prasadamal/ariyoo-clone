import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Journeys you pinned to the top of your lists. Kept on this phone, per account (a guest's pins are
 * separate from a signed-in account's), newest pin first.
 */
const PREFIX = 'wayfare_pinned_trips_v1_';
const key = (owner: string) => `${PREFIX}${owner}`;

export function parsePins(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 80).slice(0, 50) : [];
  } catch {
    return [];
  }
}

export async function loadPins(owner: string): Promise<string[]> {
  return parsePins(await AsyncStorage.getItem(key(owner)).catch(() => null));
}

/** Pin (to the top) or unpin a journey; returns the new list. */
export async function setPinned(owner: string, tripId: string, pinned: boolean): Promise<string[]> {
  const rest = (await loadPins(owner)).filter(id => id !== tripId);
  const next = pinned ? [tripId, ...rest] : rest;
  await AsyncStorage.setItem(key(owner), JSON.stringify(next));
  return next;
}

/** Removing journals from the phone removes the pins too. */
export async function clearPins() {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(k => k.startsWith(PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
