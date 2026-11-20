/**
 * Whether a native map can be shown. Android maps are Google Maps, and without a Google Maps key the
 * app closes the moment a map appears (a native crash that JavaScript cannot catch). So on Android a
 * map is only drawn when a key was built in; otherwise screens show a safe fallback instead.
 * iPhones use Apple Maps, which needs no key. The browser preview never draws the native map.
 */
export function mapsSupported(os: string, googleMapsKey: string | null | undefined): boolean {
  if (os === 'ios') return true;
  if (os === 'android') return Boolean(googleMapsKey && googleMapsKey.trim());
  return false;
}
