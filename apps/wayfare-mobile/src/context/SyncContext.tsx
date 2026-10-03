import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured } from '../config';
import { countPendingSync } from '../lib/localDb';
import { getLastSyncAt, syncAll, type SyncResult } from '../lib/sync';
import { useAuth } from './AuthContext';

type SyncState = {
  syncing: boolean;
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
  offline: boolean;
  /** Bumps after every sync / local change so screens can reload from SQLite. */
  dataVersion: number;
  syncNow: () => Promise<SyncResult | null>;
  /** Call after writing to SQLite: refreshes counters and schedules an upload. */
  notifyLocalChange: () => void;
};

const SyncContext = createContext<SyncState | null>(null);

const DEBOUNCE_MS = 4000;
const PERIODIC_MS = 5 * 60 * 1000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, dataReady } = useAuth();
  const userId = dataReady ? user?.id ?? null : null;
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  const refreshCounters = useCallback(async () => {
    setPending(await countPendingSync());
    setLastSyncAt(await getLastSyncAt());
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    const id = userRef.current;
    if (!id || !isSupabaseConfigured) return null;
    setSyncing(true);
    try {
      const result = await syncAll(id);
      setOffline(result.skipped === 'offline');
      setLastError(result.errors.length ? result.errors[0] : null);
      return result;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'Sync failed');
      return null;
    } finally {
      setSyncing(false);
      await refreshCounters();
      setDataVersion(v => v + 1);
    }
  }, [refreshCounters]);

  const notifyLocalChange = useCallback(() => {
    refreshCounters();
    setDataVersion(v => v + 1);
    if (!userRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      syncNow();
    }, DEBOUNCE_MS);
  }, [refreshCounters, syncNow]);

  // Initial sync once the account owns the local data, then on foreground / reconnect / interval.
  useEffect(() => {
    refreshCounters();
    if (!userId) return;
    syncNow();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncNow();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') syncNow();
    }, PERIODIC_MS);
    let netSub: { remove(): void } | undefined;
    import('expo-network')
      .then(Network => {
        netSub = Network.addNetworkStateListener(s => {
          if (s.isConnected && s.isInternetReachable !== false) syncNow();
        });
      })
      .catch(() => {});
    return () => {
      sub.remove();
      clearInterval(interval);
      netSub?.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId, syncNow, refreshCounters]);

  const value = useMemo(
    () => ({ syncing, pending, lastSyncAt, lastError, offline, dataVersion, syncNow, notifyLocalChange }),
    [syncing, pending, lastSyncAt, lastError, offline, dataVersion, syncNow, notifyLocalChange]
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
