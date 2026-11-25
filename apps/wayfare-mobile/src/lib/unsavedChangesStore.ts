import AsyncStorage from '@react-native-async-storage/async-storage';
import { pendingCount, unsavedText, type PendingRows, type UnsavedCopy } from './unsavedChanges';

/** Copies of offline changes a demoted editor couldn't save, per journey (this phone only). */
const KEY = 'wayfare_unsaved_changes_v1';

async function readAll(): Promise<Record<string, UnsavedCopy>> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export async function saveUnsavedCopy(tripId: string, rows: PendingRows) {
  const count = pendingCount(rows);
  if (!count) return;
  const all = await readAll();
  const prev = all[tripId];
  const text = unsavedText(rows);
  all[tripId] = {
    count: (prev?.count ?? 0) + count,
    text: [prev?.text, text].filter(Boolean).join('\n'),
    at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function getUnsavedCopy(tripId: string): Promise<UnsavedCopy | null> {
  return (await readAll())[tripId] ?? null;
}

export async function clearUnsavedCopy(tripId: string) {
  const all = await readAll();
  if (!all[tripId]) return;
  delete all[tripId];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function clearAllUnsavedCopies() {
  await AsyncStorage.removeItem(KEY);
}
