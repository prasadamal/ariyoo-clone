import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured } from '../config';
import { countPendingSync } from '../lib/localDb';
import { syncAll, type SyncResult } from '../lib/sync';
import { useAuth } from './AuthContext';

type Ctx = {
  syncing: boolean;
  lastSyncAt: string | null;
  lastErrors: string[];
  pending: number;
  syncNow: () => Promise<SyncResult | null>;
  refreshPending: () => Promise<void>;
};

const SyncContext = createContext<Ctx | null>(null);

const MIN_AUTO_INTERVAL_MS = 60_000;

/** Auto-syncs on sign-in and when the app returns to the foreground; exposes status to screens. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, ownerConflict, refreshProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastErrors, setLastErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(0);
  const lastAuto = useRef(0);

  const refreshPending = useCallback(async () => {
    setPending(await countPendingSync().catch(() => 0));
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id || ownerConflict) return null;
    setSyncing(true);
    try {
      const result = await syncAll(user.id);
      setLastErrors(result.errors);
      setLastSyncAt(new Date().toISOString());
      if (result.pushed.track_points || result.pushed.trips) refreshProfile();
      return result;
    } catch (e) {
      setLastErrors([e instanceof Error ? e.message : 'Sync failed']);
      return null;
    } finally {
      setSyncing(false);
      refreshPending();
    }
  }, [user?.id, ownerConflict, refreshProfile, refreshPending]);

  useEffect(() => {
    refreshPending();
    if (!user?.id || ownerConflict) return;
    lastAuto.current = Date.now();
    syncNow();
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      refreshPending();
      if (Date.now() - lastAuto.current < MIN_AUTO_INTERVAL_MS) return;
      lastAuto.current = Date.now();
      syncNow();
    });
    return () => sub.remove();
  }, [user?.id, ownerConflict, syncNow, refreshPending]);

  return (
    <SyncContext.Provider value={{ syncing, lastSyncAt, lastErrors, pending, syncNow, refreshPending }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync outside SyncProvider');
  return ctx;
}
