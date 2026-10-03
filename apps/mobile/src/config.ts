import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

/** Production API host — override with EXPO_PUBLIC_API_URL or app.config extra.apiUrl. */
export const PRODUCTION_API_URL = 'https://api.ariyoo.app';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const fromExtra = extra.apiUrl?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  if (!__DEV__) return PRODUCTION_API_URL;

  return (
    Platform.select({
      android: 'http://10.0.2.2:5296',
      ios: 'http://localhost:5296',
      default: 'http://localhost:5296',
    }) ?? 'http://localhost:5296'
  );
}
