import Constants from 'expo-constants';
import { envValue, isUsableSupabaseConfig } from './lib/envValue';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const supabaseUrl = envValue(process.env.EXPO_PUBLIC_SUPABASE_URL) ?? envValue(extra.supabaseUrl) ?? '';
export const supabaseAnonKey =
  envValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ?? envValue(extra.supabaseAnonKey) ?? '';

export const isSupabaseConfigured = isUsableSupabaseConfig(supabaseUrl, supabaseAnonKey);

const PAGES_BASE = 'https://ariyoo-docs.onrender.com';

/** Public read-only trip page (ariyoo-docs static site). */
export function getShareBaseUrl() {
  return envValue(process.env.EXPO_PUBLIC_WAYFARE_SHARE_BASE) ?? `${PAGES_BASE}/wayfare-share/index.html`;
}

/** Public live-location viewer for trusted contacts (ariyoo-docs static site). */
export function getLiveShareBaseUrl() {
  return envValue(process.env.EXPO_PUBLIC_WAYFARE_LIVE_BASE) ?? `${PAGES_BASE}/wayfare-live/index.html`;
}

/** A journey's story page for family and friends (no app needed). */
export function storyLinkUrl(shareId: string) {
  return `${PAGES_BASE}/wayfare-story/index.html?s=${encodeURIComponent(shareId)}`;
}

/** Page a crew invite link opens; it hands the invite to the app (wayfare://invite/<token>). */
export function inviteLinkUrl(token: string) {
  return `${PAGES_BASE}/wayfare-invite/index.html?t=${encodeURIComponent(token)}`;
}

export const PRIVACY_URL = `${PAGES_BASE}/privacy/wayfare.html`;
export const TERMS_URL = `${PAGES_BASE}/privacy/wayfare-terms.html`;
export const SUPPORT_EMAIL = 'amalprasadappu@gmail.com';

export const APP_VERSION = Constants.expoConfig?.version ?? '2.0.0';

export const googleMapsApiKey =
  envValue(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) ?? envValue(extra.googleMapsApiKey) ?? '';
