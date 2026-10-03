import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { v4 as uuid } from 'uuid';
import { insertTrackPoint } from './localDb';

export const WAYFARE_LOCATION_TASK = 'wayfare-trip-tracking';
const ACTIVE_KEY = 'wayfare_active_track_trip';

let activeTripId: string | null = null;
let watchSub: Location.LocationSubscription | null = null;

async function persistTrip(tripId: string | null) {
  activeTripId = tripId;
  if (tripId) await AsyncStorage.setItem(ACTIVE_KEY, tripId);
  else await AsyncStorage.removeItem(ACTIVE_KEY);
}

async function resolveTripId() {
  if (activeTripId) return activeTripId;
  return AsyncStorage.getItem(ACTIVE_KEY);
}

async function savePoint(tripId: string, loc: Location.LocationObject) {
  await insertTrackPoint({
    id: uuid(),
    trip_id: tripId,
    recorded_at: new Date(loc.timestamp).toISOString(),
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude_m: loc.coords.altitude,
    accuracy_m: loc.coords.accuracy,
  });
}

TaskManager.defineTask(WAYFARE_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const tripId = await resolveTripId();
  if (!tripId) return;
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations?.length) return;
  const loc = locations[locations.length - 1];
  await savePoint(tripId, loc);
});

export async function startTripTracking(tripId: string) {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission required to record your route.');
  await Location.requestBackgroundPermissionsAsync();
  await persistTrip(tripId);

  const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await savePoint(tripId, here);

  if (watchSub) {
    watchSub.remove();
    watchSub = null;
  }
  watchSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 30_000 },
    loc => {
      savePoint(tripId, loc).catch(() => {});
    }
  );

  const started = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  try {
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
  } catch {
    // Foreground watch still records points if background service is unavailable.
  }
}

export async function stopTripTracking() {
  await persistTrip(null);
  if (watchSub) {
    watchSub.remove();
    watchSub = null;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
}

export function getActiveTrackingTripId() {
  return activeTripId;
}

export async function hydrateTrackingState() {
  activeTripId = await AsyncStorage.getItem(ACTIVE_KEY);
  return activeTripId;
}
