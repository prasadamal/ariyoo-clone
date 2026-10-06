import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_TRIP_KEY = 'wayfare_tracking_trip_v1';
const TRACKING_MODE_KEY = 'wayfare_tracking_mode_v1';
const LIVE_SHARE_KEY = 'wayfare_live_share_v1';

export type TrackingMode = 'battery' | 'precise';

export type LiveShareState = {
  id: string;
  label: string | null;
  expiresAt: string;
  lastPushAt?: string;
};

// The background task can run in a fresh JS context, so state lives in storage with a
// small in-memory cache for the hot path.
let cachedTrip: string | null | undefined;
let cachedLive: LiveShareState | null | undefined;

export async function getActiveTripId() {
  if (cachedTrip === undefined) cachedTrip = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  return cachedTrip;
}

export async function setActiveTripId(tripId: string | null) {
  cachedTrip = tripId;
  if (tripId) await AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);
  else await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
}

export async function getTrackingMode(): Promise<TrackingMode> {
  return (await AsyncStorage.getItem(TRACKING_MODE_KEY)) === 'precise' ? 'precise' : 'battery';
}

export async function setTrackingMode(mode: TrackingMode) {
  await AsyncStorage.setItem(TRACKING_MODE_KEY, mode);
}

export async function getLiveShareState(): Promise<LiveShareState | null> {
  if (cachedLive === undefined) {
    const raw = await AsyncStorage.getItem(LIVE_SHARE_KEY);
    try {
      cachedLive = raw ? (JSON.parse(raw) as LiveShareState) : null;
    } catch {
      cachedLive = null;
    }
  }
  if (cachedLive && new Date(cachedLive.expiresAt).getTime() <= Date.now()) {
    await setLiveShareState(null);
    return null;
  }
  return cachedLive;
}

export async function setLiveShareState(state: LiveShareState | null) {
  cachedLive = state;
  if (state) await AsyncStorage.setItem(LIVE_SHARE_KEY, JSON.stringify(state));
  else await AsyncStorage.removeItem(LIVE_SHARE_KEY);
}
