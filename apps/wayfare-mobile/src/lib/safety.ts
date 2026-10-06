import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';
import { v4 as uuid } from 'uuid';
import { cancelLocal, scheduleLocal } from './notifications';

const CONTACTS_KEY = 'wayfare_emergency_contacts_v1';
const CHECKIN_KEY = 'wayfare_checkin_v1';
const NAME_KEY = 'wayfare_sos_name_v1';

export type EmergencyContact = { id: string; name: string; phone: string };
export type CheckIn = { dueAt: string; label: string | null; notificationIds: string[] };

export async function getContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addContact(name: string, phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.replace(/\D/g, '').length < 6) throw new Error('Enter a valid phone number (with country code if abroad).');
  const list = await getContacts();
  if (list.length >= 5) throw new Error('You can save up to 5 emergency contacts.');
  const next = [...list, { id: uuid(), name: name.trim() || cleaned, phone: cleaned }];
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  return next;
}

export async function removeContact(id: string) {
  const next = (await getContacts()).filter(c => c.id !== id);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  return next;
}

export async function getSosName() {
  return AsyncStorage.getItem(NAME_KEY);
}

export async function setSosName(name: string) {
  await AsyncStorage.setItem(NAME_KEY, name.trim());
}

/** Opens the SMS composer pre-filled for all contacts (the traveller taps send). */
export async function sendSms(phones: string[], message: string) {
  if (await SMS.isAvailableAsync()) {
    const { result } = await SMS.sendSMSAsync(phones, message);
    return result;
  }
  const sep = Platform.OS === 'ios' ? '&' : '?';
  await Linking.openURL(`sms:${phones.join(',')}${sep}body=${encodeURIComponent(message)}`);
  return 'unknown';
}

export async function callNumber(number: string) {
  await Linking.openURL(`tel:${number}`);
}

export async function getCheckIn(): Promise<CheckIn | null> {
  try {
    const raw = await AsyncStorage.getItem(CHECKIN_KEY);
    return raw ? (JSON.parse(raw) as CheckIn) : null;
  } catch {
    return null;
  }
}

/** Schedules a reminder at the check-in time and a louder one 30 minutes after. */
export async function startCheckIn(minutes: number, label: string | null) {
  await cancelCheckIn();
  const due = new Date(Date.now() + minutes * 60_000);
  const first = await scheduleLocal({
    title: 'Time to check in',
    body: `${label ? `${label}: ` : ''}let your people know you are safe.`,
    at: due,
    url: '/safety',
    channelId: 'safety',
  });
  const second = await scheduleLocal({
    title: 'Overdue check-in',
    body: 'You have not checked in. Tap to check in — or send an SOS if you need help.',
    at: new Date(due.getTime() + 30 * 60_000),
    url: '/safety',
    channelId: 'safety',
  });
  const state: CheckIn = { dueAt: due.toISOString(), label, notificationIds: [first, second] };
  await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(state));
  return state;
}

export async function cancelCheckIn() {
  const current = await getCheckIn();
  for (const id of current?.notificationIds ?? []) await cancelLocal(id);
  await AsyncStorage.removeItem(CHECKIN_KEY);
}
