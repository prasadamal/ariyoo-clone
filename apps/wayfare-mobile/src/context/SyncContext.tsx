import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured } from '../config';
import { syncAll } from '../lib/sync';
import { useAuth } from './AuthContext';

/** Background sync when app returns to foreground (signed-in + Supabase). */
export function SyncOnForeground() {
  const { user } = useAuth();
  const busy = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' || busy.current) return;
      busy.current = true;
      syncAll(user.id)
        .catch(() => {})
        .finally(() => {
          busy.current = false;
        });
    });
    return () => sub.remove();
  }, [user?.id]);

  return null;
}
