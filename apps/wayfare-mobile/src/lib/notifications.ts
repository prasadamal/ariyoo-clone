import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, removePushToken } from '../social/notifications';

const PUSH_PREF_KEY = 'wayfare_push_pref_v1';
const PUSH_TOKEN_KEY = 'wayfare_push_token_v1';

export type PushPreference = 'on' | 'off' | 'unset';

let configured = false;

export function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    }).catch(() => undefined);
    Notifications.setNotificationChannelAsync('social', {
      name: 'Follows, likes & trip matches',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
    Notifications.setNotificationChannelAsync('safety', {
      name: 'Safety check-ins',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      bypassDnd: true,
    }).catch(() => undefined);
  }
}

export async function getPushPreference(): Promise<PushPreference> {
  const v = await AsyncStorage.getItem(PUSH_PREF_KEY);
  return v === 'on' || v === 'off' ? v : 'unset';
}

function easProjectId(): string | null {
  const id =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!id || id.startsWith('00000000-')) return null;
  return id;
}

/** Asks for permission and registers this device for push. Returns a user-facing status. */
export async function enablePush(): Promise<{ ok: boolean; message: string }> {
  configureNotifications();
  if (!Device.isDevice) return { ok: false, message: 'Push notifications need a physical device.' };
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    await AsyncStorage.setItem(PUSH_PREF_KEY, 'off');
    return { ok: false, message: 'Notifications are off for Wayfare in your device settings.' };
  }
  const projectId = easProjectId();
  if (!projectId) {
    await AsyncStorage.setItem(PUSH_PREF_KEY, 'on');
    return { ok: true, message: 'Local reminders are on. Remote push activates once this build has an EAS project id.' };
  }
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Offline, or the build has no push credentials (Android needs google-services.json).
    await AsyncStorage.setItem(PUSH_PREF_KEY, 'on');
    return { ok: true, message: 'Local reminders are on. Push could not be set up yet — Wayfare will retry on the next launch.' };
  }
  await registerPushToken(token, Platform.OS);
  await AsyncStorage.multiSet([
    [PUSH_PREF_KEY, 'on'],
    [PUSH_TOKEN_KEY, token],
  ]);
  return { ok: true, message: 'Push notifications are on.' };
}

export async function disablePush() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (token) await removePushToken(token).catch(() => undefined);
  await AsyncStorage.multiSet([[PUSH_PREF_KEY, 'off']]);
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

/** Re-registers on sign-in (tokens can rotate, or the device may have switched accounts). */
export async function refreshPushRegistration() {
  if ((await getPushPreference()) !== 'on') return;
  try {
    await enablePush();
  } catch {
    // offline or permission revoked; try again next launch
  }
}

/** Unregisters this device from the current account before sign-out. */
export async function forgetPushToken() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (token) await removePushToken(token).catch(() => undefined);
}

export async function scheduleLocal(params: {
  title: string;
  body: string;
  at: Date;
  url?: string;
  channelId?: 'safety' | 'social' | 'messages';
}) {
  configureNotifications();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    const req = await Notifications.requestPermissionsAsync();
    if (!req.granted) throw new Error('Allow notifications so Wayfare can remind you.');
  }
  return Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: 'default',
      data: params.url ? { url: params.url } : {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.at,
      channelId: params.channelId ?? 'social',
    },
  });
}

export async function cancelLocal(id: string | null | undefined) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

export async function setAppBadge(count: number) {
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}

/** Opens the screen a tapped notification points to (also on cold start). */
export function useNotificationRouting() {
  useEffect(() => {
    configureNotifications();
    let handled = false;
    const go = (resp: Notifications.NotificationResponse | null) => {
      const url = resp?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        // Give the navigator a moment to mount on cold start.
        setTimeout(() => router.push(url as never), handled ? 0 : 400);
        handled = true;
      }
    };
    try {
      go(Notifications.getLastNotificationResponse());
    } catch {
      // no launch notification available
    }
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);
}
