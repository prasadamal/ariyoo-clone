import { toDayString } from './format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { APP_VERSION } from '../config';
import { uuid } from './id';
import { supabase } from './supabase';
import { enqueue, scrubDetail, shouldCount, type QueuedEvent, type UsageEvent } from './telemetryRules';

/**
 * Anonymous usage counts and crash reports, sent to Wayfare's own database (no third parties).
 * Never content: just event names like "moment_added", the app version and a random device id.
 * Off when the person turns "Share usage & crash reports" off in Settings.
 */
const ENABLED_KEY = 'wayfare_telemetry_enabled_v1';
const DEVICE_KEY = 'wayfare_device_id_v1';
const QUEUE_KEY = 'wayfare_telemetry_queue_v1';
const OPEN_DAY_KEY = 'wayfare_telemetry_open_day_v1';

let enabledCache: boolean | null = null;
let flushing = false;

export async function telemetryEnabled() {
  if (enabledCache == null) enabledCache = (await AsyncStorage.getItem(ENABLED_KEY).catch(() => null)) !== 'off';
  return enabledCache;
}

export async function setTelemetryEnabled(on: boolean) {
  enabledCache = on;
  await AsyncStorage.setItem(ENABLED_KEY, on ? 'on' : 'off');
  if (!on) await AsyncStorage.removeItem(QUEUE_KEY).catch(() => undefined);
}

export async function deviceId() {
  let id = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => undefined);
  }
  return id;
}

async function push(e: QueuedEvent) {
  // The browser preview is only used for testing: its counts would mix with real phones' numbers.
  if (Platform.OS === 'web' || !(await telemetryEnabled())) return;
  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  let queue: QueuedEvent[] = [];
  try {
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(enqueue(queue, e))).catch(() => undefined);
  void flushTelemetry();
}

/** Counts one use of a feature (no content, ever). */
export async function track(name: UsageEvent) {
  try {
    const today = toDayString(new Date()); // "once a day" by the phone's own calendar
    if (name === 'app_open') {
      const last = await AsyncStorage.getItem(OPEN_DAY_KEY).catch(() => null);
      if (!shouldCount(name, last, today)) return;
      await AsyncStorage.setItem(OPEN_DAY_KEY, today).catch(() => undefined);
    }
    await push({ kind: 'event', name, detail: null, at: new Date().toISOString() });
  } catch {
    // never let reporting break the app
  }
}

/** Records a JavaScript error (scrubbed of personal details) to fix it later. */
export async function reportError(error: unknown, where = 'app') {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const detail = scrubDetail(`${where}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 8).join('\n')}`);
    await push({ kind: 'error', name: (e.name || 'Error').slice(0, 80), detail, at: new Date().toISOString() });
  } catch {
    // never let reporting break the app
  }
}

/** Sends whatever is waiting. Keeps it for later if offline or the server says no. */
export async function flushTelemetry() {
  if (flushing || !supabase || Platform.OS === 'web' || !(await telemetryEnabled())) return;
  flushing = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    if (!queue.length) return;
    const device = await deviceId();
    const rows = queue.map(q => ({ device_id: device, kind: q.kind, name: q.name, detail: q.detail, app_version: APP_VERSION.slice(0, 20), platform: Platform.OS }));
    const { error } = await supabase.from('app_events').insert(rows);
    if (!error) {
      // Only remove what was sent; anything queued meanwhile stays.
      const now = await AsyncStorage.getItem(QUEUE_KEY);
      const left: QueuedEvent[] = now ? JSON.parse(now) : [];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(left.slice(queue.length)));
    }
  } catch {
    // offline: try again next time
  } finally {
    flushing = false;
  }
}

/** Sends feedback from the Settings box. Throws a friendly message on failure (the text stays). */
export async function sendFeedback(message: string, contact: string) {
  if (!supabase) throw new Error('Feedback needs the internet. Try again when you are online.');
  const { error } = await supabase.from('app_feedback').insert({
    device_id: await deviceId(),
    message: message.trim().slice(0, 4000),
    contact: contact.trim().slice(0, 200) || null,
    app_version: APP_VERSION.slice(0, 20),
    platform: Platform.OS,
  });
  if (error) throw new Error('Could not send. Check your connection and try again.');
}

/** Catches errors nobody else caught, reports them, then lets the app handle them as before. */
export function installGlobalErrorReporting() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((e, fatal) => {
    void reportError(e, fatal ? 'fatal' : 'uncaught');
    previous(e, fatal);
  });
}
