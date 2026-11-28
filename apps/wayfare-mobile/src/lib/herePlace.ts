import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { placeFromCoords, type FoundPlace } from './reverseGeocode';
import { trustedFix } from './fixTrust';

/** Where you are now: the place's name, and the point when the reading can be trusted. */
export type HerePlace = FoundPlace & {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  /** A fresh, accurate reading from the phone's own location (not a fake-GPS app): the moment is verified. */
  verified: boolean;
};

/**
 * Tap the pin in the moment box: a fresh reading, named with the phone's own map lookup (free, no
 * key). A reading that is old, rough or from a fake-location app still names the place, but keeps
 * no point and isn't verified, so verified places can't be faked.
 */
export async function placeHere(): Promise<HerePlace> {
  if (Platform.OS === 'web') throw new Error('Location works in the app on your phone. Long-press the pin to type the place.');
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Allow location to add where you are, or long-press the pin to type the place.');
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) throw new Error('Turn on location, or long-press the pin to type the place.');
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 15_000)),
  ]);
  if (!fix) throw new Error('Couldn’t find where you are. Try again outside, or long-press the pin to type the place.');
  const place = await placeFromCoords(fix.coords.latitude, fix.coords.longitude);
  if (!place?.name && !place?.countryCode) throw new Error('Couldn’t name this place (no signal?). Long-press the pin to type it.');
  const verified = trustedFix({ mocked: fix.mocked, accuracy: fix.coords.accuracy, timestamp: fix.timestamp });
  return {
    ...place,
    latitude: verified ? fix.coords.latitude : null,
    longitude: verified ? fix.coords.longitude : null,
    altitude: verified ? fix.coords.altitude ?? null : null,
    verified,
  };
}
