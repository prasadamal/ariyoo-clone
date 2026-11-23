import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseLists, type PackingLists } from './packingLists';

export const PACKING_LISTS_KEY = 'wayfare_packing_lists_v1';
const tripKey = (tripId: string) => `wayfare_trip_pack_list_v1_${tripId}`;

export async function loadPackingLists(): Promise<PackingLists> {
  return parseLists(await AsyncStorage.getItem(PACKING_LISTS_KEY).catch(() => null));
}

export async function savePackingLists(lists: PackingLists) {
  await AsyncStorage.setItem(PACKING_LISTS_KEY, JSON.stringify(lists));
}

export async function loadTripList(tripId: string): Promise<string | null> {
  const v = await AsyncStorage.getItem(tripKey(tripId)).catch(() => null);
  return v && v.length < 80 ? v : null;
}

export async function saveTripList(tripId: string, id: string) {
  await AsyncStorage.setItem(tripKey(tripId), id).catch(() => undefined);
}

/** Removing journals from the phone removes the personal lists and per-journey choices too. */
export async function clearPackingLists() {
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter(
    k => k === PACKING_LISTS_KEY || k.startsWith('wayfare_trip_pack_list_v1_')
  );
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
