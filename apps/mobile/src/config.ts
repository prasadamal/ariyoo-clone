import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiBase } from './lib/release';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; eas?: { projectId?: string } };

const devDefault = Platform.OS === 'android' ? 'http://10.0.2.2:5296' : 'http://localhost:5296';

/**
 * Where the API lives. Store builds must be built with EXPO_PUBLIC_API_URL (an EAS environment
 * variable); there is deliberately no built-in production address to fall back to.
 */
export function getApiBaseUrl(): string {
  return apiBase(process.env.EXPO_PUBLIC_API_URL) ?? apiBase(extra.apiUrl) ?? (__DEV__ ? devDefault : '');
}

export const isApiConfigured = getApiBaseUrl() !== '';

const PAGES_BASE = 'https://ariyoo-docs.onrender.com';
export const PRIVACY_URL = `${PAGES_BASE}/privacy/ariyoo.html`;
export const TERMS_URL = `${PAGES_BASE}/privacy/ariyoo-terms.html`;
export const SUPPORT_EMAIL = 'amalprasadappu@gmail.com';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export function easProjectId(): string | null {
  const id = extra.eas?.projectId ?? Constants.easConfig?.projectId;
  return id && !id.startsWith('00000000-') ? id : null;
}
