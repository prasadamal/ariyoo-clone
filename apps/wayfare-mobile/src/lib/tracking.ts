import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { newId } from './id';
import { getMeta, insertTrackPoint, setMeta } from './localDb';

export const WAYFARE_LOCATION_TASK = 'wayfare-trip-tracking';
const ACTIVE_KEY = 'tracking_trip_id';
/** Drop very imprecise fixes (e.g. cell-tower fallbacks) so the route stays clean. */
const MAX_ACCURACY_M = 150;

// Must be defined at module scope: the OS can wake the app headlessly for location updates.
// The active trip is read from SQLite (a module variable would be lost if the process was killed).
TaskManager.defineTask(WAYFARE_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const tripId = await getMeta(ACTIVE_KEY);
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!tripId || !locations?.length) return;
  for (const loc of locations) {
    const accuracy = loc.coords.accuracy;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) continue;
    await insertTrackPoint({
      id: newId(),
      trip_id: tripId,
      recorded_at: new Date(loc.timestamp).toISOString(),
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude_m: loc.coords.altitude,
      accuracy_m: accuracy,
    });
  }
});

export class LocationPermissionError extends Error {}

export async function startTripTracking(tripId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    throw new LocationPermissionError('Location permission is needed to record your route. You can enable it in Settings.');
  }
  await setMeta(ACTIVE_KEY, tripId);
  if (await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  }
  try {
    await Location.startLocationUpdatesAsync(WAYFARE_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60_000,
      distanceInterval: 25,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android: a user-started foreground service keeps recording with the screen off
      // and needs only the "while in use" permission.
      foregroundService: {
        notificationTitle: 'Wayfare is recording your route',
        notificationBody: 'Open the app to stop recording.',
      },
    });
  } catch (e) {
    await setMeta(ACTIVE_KEY, null);
    throw e;
  }
}

export async function stopTripTracking() {
  await setMeta(ACTIVE_KEY, null).catch(() => {});
  try {
    if (await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
    }
  } catch {
    // task not registered
  }
}

/** The trip currently being recorded, or null (verifies the OS task is really running). */
export async function getActiveTrackingTripId(): Promise<string | null> {
  const id = await getMeta(ACTIVE_KEY);
  if (!id) return null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK)) return id;
  } catch {
    // fall through
  }
  await setMeta(ACTIVE_KEY, null).catch(() => {});
  return null;
}
