import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const PAGES_BASE = 'https://prasadamal.github.io/ariyoo-clone';

/** Public read-only trip page (GitHub Pages). */
export function getShareBaseUrl() {
  return process.env.EXPO_PUBLIC_WAYFARE_SHARE_BASE ?? `${PAGES_BASE}/wayfare-share/index.html`;
}

/** Public live-location viewer for trusted contacts (GitHub Pages). */
export function getLiveShareBaseUrl() {
  return process.env.EXPO_PUBLIC_WAYFARE_LIVE_BASE ?? `${PAGES_BASE}/wayfare-live/index.html`;
}

export const PRIVACY_URL = `${PAGES_BASE}/privacy/wayfare.html`;
export const TERMS_URL = `${PAGES_BASE}/privacy/wayfare-terms.html`;
export const SUPPORT_EMAIL = 'support@ariyoo.app';

export const APP_VERSION = Constants.expoConfig?.version ?? '2.0.0';

export const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? extra.googleMapsApiKey ?? '';
