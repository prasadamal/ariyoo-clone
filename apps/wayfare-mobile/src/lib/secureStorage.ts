import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase sessions are larger than SecureStore's ~2 KB per-value limit, so a
 * value is split across several keychain/keystore entries.
 */
const CHUNK = 1500;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function removeChunks(key: string) {
  const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  await SecureStore.deleteItemAsync(countKey(key));
}

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
    if (!n) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) return null; // corrupted -> treat as signed out
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await removeChunks(key);
    const parts = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < parts; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(countKey(key), String(parts));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await removeChunks(key);
  },
};
