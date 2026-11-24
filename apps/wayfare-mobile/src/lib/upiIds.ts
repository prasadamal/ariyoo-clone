import AsyncStorage from '@react-native-async-storage/async-storage';
import { upiKey } from './upi';

/** UPI IDs remembered on this phone for Settle up: your own ("me") and the people you pay. */
const KEY = 'wayfare_upi_ids_v1';

export async function getUpiIds(): Promise<Record<string, string>> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export async function setUpiId(name: string, upiId: string | null) {
  const all = await getUpiIds();
  if (upiId) all[upiKey(name)] = upiId;
  else delete all[upiKey(name)];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
  return all;
}

export const MY_UPI = 'me';
