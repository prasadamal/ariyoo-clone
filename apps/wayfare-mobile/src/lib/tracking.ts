import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuid } from 'uuid';
import { insertTrackPoint } from './localDb';

export const WAYFARE_LOCATION_TASK = 'wayfare-trip-tracking';

let activeTripId: string | null = null;

TaskManager.defineTask(WAYFARE_LOCATION_TASK, async ({ data, error }) => {
  if (error || !activeTripId) return;
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations?.length) return;
  const loc = locations[locations.length - 1];
  await insertTrackPoint({
    id: uuid(),
    trip_id: activeTripId,
    recorded_at: new Date(loc.timestamp).toISOString(),
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude_m: loc.coords.altitude,
    accuracy_m: loc.coords.accuracy,
  });
});

export async function startTripTracking(tripId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission required to record your route.');
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) {
    // Foreground-only fallback for MVP
  }
  activeTripId = tripId;
  const started = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  await Location.startLocationUpdatesAsync(WAYFARE_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60_000,
    distanceInterval: 25,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Wayfare',
      notificationBody: 'Recording your trip route',
    },
  });
}

export async function stopTripTracking() {
  activeTripId = null;
  const started = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
}

export function getActiveTrackingTripId() {
  return activeTripId;
}
