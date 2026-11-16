import { createJournalGate, withJournalLock } from './journalGate';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { uuid } from './id';
import { createLiveShare, endLiveShare, pushLiveLocation } from './liveShare';
import { getTrip, insertTrackPoint } from './localDb';
import {
  getActiveTripId,
  getLiveShareState,
  getTrackingMode,
  setActiveTripId,
  setTrackingMode,
  type TrackingMode,
} from './locationState';

const withLocationLock = createJournalGate();

export const WAYFARE_LOCATION_TASK = 'wayfare-trip-tracking';

// Must be defined at module load so background relaunches find it (imported by the root layout).
TaskManager.defineTask(WAYFARE_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  if (!locations.length) return;
  await withJournalLock(async () => {
    const tripId = await getActiveTripId();
    if (tripId && await getTrip(tripId)) {
      for (const loc of locations) {
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
    }
  });
  const last = locations[locations.length - 1];
  await pushLiveLocation({
    latitude: last.coords.latitude,
    longitude: last.coords.longitude,
    accuracy: last.coords.accuracy,
  }).catch(() => undefined);
});

async function requestPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission is required for route recording and live location.');
  // "While using" is enough: updates continue in the background through the Android foreground
  // service and the iOS location background mode, so Wayfare never asks for "Allow all the time".
}

/** Starts or stops OS location updates to match what is active (route recording / live share). */
async function refreshLocationUpdatesLocked() {
  const [tripId, live, mode] = await Promise.all([getActiveTripId(), getLiveShareState(), getTrackingMode()]);
  const running = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  if (!tripId && !live) return;
  const precise = tripId && mode === 'precise';
  await Location.startLocationUpdatesAsync(WAYFARE_LOCATION_TASK, {
    accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: precise ? 15_000 : 60_000,
    distanceInterval: precise ? 10 : 25,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    foregroundService: {
      notificationTitle: 'Wayfare',
      notificationBody: tripId
        ? live
          ? 'Recording your route · sharing live location'
          : 'Recording your trip route'
        : 'Sharing your live location',
      notificationColor: '#c2410c',
    },
  });
}

async function startTripTrackingLocked(tripId: string, mode?: TrackingMode) {
  await requestPermissions();
  const previousTrip = await getActiveTripId();
  const previousMode = await getTrackingMode();
  if (mode) await setTrackingMode(mode);
  await setActiveTripId(tripId);
  try { await refreshLocationUpdatesLocked(); }
  catch (error) {
    await setActiveTripId(previousTrip);
    await setTrackingMode(previousMode);
    await refreshLocationUpdatesLocked().catch(() => undefined);
    throw error;
  }
}

async function stopTripTrackingLocked() {
  await setActiveTripId(null);
  await refreshLocationUpdatesLocked();
}

/** Returns the trip being recorded, clearing stale state if the OS stopped updates (e.g. reboot). */
async function getActiveTrackingTripIdLocked() {
  const tripId = await getActiveTripId();
  if (!tripId) return null;
  const running = await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK).catch(() => false);
  if (!running) {
    await setActiveTripId(null);
    return null;
  }
  return tripId;
}

async function startLiveSharingLocked(hours: number, label: string | null) {
  await requestPermissions();
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const state = await createLiveShare({
    hours,
    label,
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  });
  await refreshLocationUpdatesLocked();
  return state;
}

async function stopLiveSharingLocked() {
  await endLiveShare();
  await refreshLocationUpdatesLocked();
}

export { getLiveShareState, getTrackingMode, setTrackingMode };
export type { TrackingMode };

// Route and live sharing share one OS task; keep its start/stop transitions ordered.
export const refreshLocationUpdates = () => withLocationLock(refreshLocationUpdatesLocked);
export const startTripTracking = (tripId: string, mode?: TrackingMode) => withLocationLock(() => startTripTrackingLocked(tripId, mode));
export const stopTripTracking = () => withLocationLock(stopTripTrackingLocked);
export const getActiveTrackingTripId = () => withLocationLock(getActiveTrackingTripIdLocked);
export const startLiveSharing = (hours: number, label: string | null) => withLocationLock(() => startLiveSharingLocked(hours, label));
export const stopLiveSharing = () => withLocationLock(stopLiveSharingLocked);

/** Stop local collection while retaining an older account's link for authenticated revocation. */
export const stopLocalLocationUpdates = () => withLocationLock(async () => {
  await setActiveTripId(null);
  if (await Location.hasStartedLocationUpdatesAsync(WAYFARE_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(WAYFARE_LOCATION_TASK);
  }
});
