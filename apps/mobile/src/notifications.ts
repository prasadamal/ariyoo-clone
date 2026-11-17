import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api/client';
import { easProjectId } from './config';
import { deleteItem, getItem, setItem } from './storage';

const TOKEN_KEY = 'push_token';
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Questions and replies',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => undefined);
  }
}

export async function pushPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Registers this phone for notifications about new questions and replies.
 * `ask: false` never shows the system prompt; it only refreshes an existing registration.
 */
export async function registerForPush(ask: boolean): Promise<boolean> {
  configure();
  if (!Device.isDevice) return false;
  try {
    let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && ask && canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    const projectId = easProjectId();
    if (!projectId) return false;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/api/user/pushToken', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    await setItem(TOKEN_KEY, token);
    return true;
  } catch {
    // Offline, or the build has no push credentials yet. The app works without it.
    return false;
  }
}

/** Call before the sign-in token is thrown away, so the next person on this phone gets no alerts for this account. */
export async function unregisterPush(): Promise<void> {
  const token = await getItem(TOKEN_KEY);
  if (!token) return;
  await api.delete('/api/user/pushToken', { data: { token } }).catch(() => undefined);
  await deleteItem(TOKEN_KEY);
}

function open(data: unknown) {
  const sessionId = Number((data as { sessionId?: unknown } | null)?.sessionId);
  if (Number.isSafeInteger(sessionId) && sessionId > 0) {
    router.push({ pathname: '/chat/[sessionId]', params: { sessionId: String(sessionId) } });
  }
}

/** Opens the right conversation when a notification is tapped (running or cold start). */
export function useNotificationTaps(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    configure();
    let handled: string | null = null;
    const handle = (response: Notifications.NotificationResponse | null) => {
      const id = response?.notification.request.identifier;
      if (!response || !id || id === handled) return;
      handled = id;
      open(response.notification.request.content.data);
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [signedIn]);
}
