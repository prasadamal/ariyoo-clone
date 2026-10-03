import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../config';
import { chunkedSecureStorage } from './secureStorage';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: chunkedSecureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// React Native has no tab-visibility events: tell the auth client when to
// refresh tokens (only while the app is in the foreground).
if (supabase) {
  const sync = (state: string) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  sync(AppState.currentState);
  AppState.addEventListener('change', sync);
}
