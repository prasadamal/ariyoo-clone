import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDestination } from '../content/destinations';
import type { LocalTrip } from './localDb';
import { configureNotifications } from './notifications';
import { nudgeContent, nudgePlan, tripForecast, weatherTip } from './packingNudges';
import { computeTripStats } from './tripStats';
import { tripStatus } from './tripList';
import { fetchForecast } from './weather';

/**
 * Packing nudges: two local reminders before each upcoming journey (3 days before at 9 am, the
 * evening before at 7 pm), saying how much is left to pack, with a weather tip once the forecast
 * reaches the trip. Re-planned whenever Journeys loads, so they follow packing and date changes.
 * Never asks for notification permission itself: the Settings switch does that.
 */
const KEY = 'wayfare_packing_nudges_v1';
const PREFIX = 'wayfare-pack-';

export async function packingNudgesEnabled() {
  return (await AsyncStorage.getItem(KEY).catch(() => null)) !== 'off';
}

export async function setPackingNudgesEnabled(on: boolean, trips: LocalTrip[] = []) {
  if (on) {
    configureNotifications();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) {
      throw new Error('Allow notifications so Wayfare can remind you to pack.');
    }
  }
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  await refreshPackingNudges(trips);
}

let running: Promise<void> | null = null;

/** Replaces every packing nudge with fresh ones for these journeys (coming up in the next 30 days). */
export function refreshPackingNudges(trips: LocalTrip[]): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  running = (running ?? Promise.resolve()).then(() => plan(trips)).catch(() => undefined);
  return running;
}

async function plan(trips: LocalTrip[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter(n => n.identifier.startsWith(PREFIX)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined))
  );
  if (!(await packingNudgesEnabled())) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  configureNotifications();
  const soon = Date.now() + 30 * 86400000;
  for (const t of trips) {
    if (!t.starts_on || tripStatus(t) !== 'upcoming' || new Date(`${t.starts_on}T00:00:00`).getTime() > soon) continue;
    const plans = nudgePlan(t.starts_on);
    if (!plans.length) continue;
    const stats = await computeTripStats(t.id, t).catch(() => null);
    const left = stats && stats.packingTotal ? stats.packingTotal - stats.packingDone : null;
    // The forecast covers ~16 days; a trip further out gets the tip on a later re-plan.
    let tip = null;
    const lat = t.dest_lat ?? getDestination(t.place_key)?.lat;
    const lng = t.dest_lng ?? getDestination(t.place_key)?.lng;
    if (lat != null && lng != null && new Date(`${t.starts_on}T00:00:00`).getTime() - Date.now() < 15 * 86400000) {
      tip = weatherTip(tripForecast(await fetchForecast(lat, lng, 16).catch(() => []), t.starts_on, t.ends_on));
    }
    for (const p of plans) {
      const content = nudgeContent(p.kind, t.title, left, tip);
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${t.id}-${p.kind}`,
        content: { ...content, data: { url: `/trip/${t.id}?tab=plan` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: 'social' },
      }).catch(() => undefined);
    }
  }
}
