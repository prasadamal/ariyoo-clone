import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Public read-only trip page (GitHub Pages). */
export function getShareBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_WAYFARE_SHARE_BASE ??
    extra.shareBaseUrl ??
    'https://prasadamal.github.io/ariyoo-clone/wayfare-share/index.html'
  );
}

export const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? extra.googleMapsApiKey ?? '';

export const PRIVACY_URL = 'https://prasadamal.github.io/ariyoo-clone/privacy/wayfare.html';
export const DELETE_ACCOUNT_URL = 'https://prasadamal.github.io/ariyoo-clone/privacy/wayfare-delete-account.html';
export const SUPPORT_EMAIL = 'support@ariyoo.app';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
