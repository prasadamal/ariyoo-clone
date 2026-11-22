import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { entriesNeedingPlace, setEntryPlace } from './localDb';

export type FoundPlace = { name: string | null; region: string | null; countryCode: string | null };

/**
 * City, state and country for a point, from the phone's own map lookup (no extra service or key).
 * Null when it isn't available (the web preview, offline, or nothing found).
 */
export async function placeFromCoords(latitude: number, longitude: number): Promise<FoundPlace | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!hit) return null;
    const name = hit.city || hit.subregion || hit.district || hit.name || null;
    return { name, region: hit.region || null, countryCode: hit.isoCountryCode ? hit.isoCountryCode.toUpperCase() : null };
  } catch {
    return null;
  }
}

/** Looks up a few older moments at a time (the phone's lookup is rate-limited). Returns how many it filled. */
export async function fillMissingPlaces(limit = 10): Promise<number> {
  if (Platform.OS === 'web') return 0;
  let filled = 0;
  for (const e of await entriesNeedingPlace(limit)) {
    const place = await placeFromCoords(e.latitude as number, e.longitude as number);
    if (!place?.countryCode) continue;
    await setEntryPlace(e.id, place);
    filled += 1;
  }
  return filled;
}
