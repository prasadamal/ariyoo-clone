import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { configureNotifications } from './notifications';

/** A gentle daily nudge to write today's diary page, at a time you choose. Local only (no server). */
const KEY = 'wayfare_diary_reminder_v1';
const ID = 'wayfare-diary-reminder';

export type DiaryReminder = { on: boolean; hour: number };

export const REMINDER_HOURS = [19, 20, 21, 22];

export async function getDiaryReminder(): Promise<DiaryReminder> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
    if (v && typeof v.on === 'boolean' && REMINDER_HOURS.includes(v.hour)) return v;
  } catch {
    // fall through
  }
  return { on: false, hour: 21 };
}

/** Turns the reminder on/off or moves it; asks for notification permission the first time. */
export async function setDiaryReminder(next: DiaryReminder) {
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
  if (next.on) {
    configureNotifications();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) {
      throw new Error('Allow notifications so Wayfare can remind you.');
    }
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: 'Your diary is waiting ✍️', body: 'A line or two about today — it only takes a minute.', data: { url: '/journal' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: next.hour, minute: 0, channelId: 'social' },
    });
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export const hourLabel = (h: number) => `${h > 12 ? h - 12 : h} pm`;
