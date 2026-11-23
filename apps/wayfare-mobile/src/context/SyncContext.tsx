import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured } from '../config';
import { countPendingSync } from '../lib/localDb';
import { syncAll, type SyncResult } from '../lib/sync';
import { initialSyncState, syncReducer, type SyncState } from '../lib/syncState';
import { useAuth } from './AuthContext';

type Ctx = {
  phase: SyncState['phase'];
  syncing: boolean;
  lastSyncAt: string | null;
  lastErrors: string[];
  /** Changes waiting to upload; null when they couldn't be counted. */
  pending: number | null;
  syncNow: () => Promise<SyncResult | null>;
  refreshPending: () => Promise<void>;
};

const SyncContext = createContext<Ctx | null>(null);

const MIN_AUTO_INTERVAL_MS = 60_000;

/** Auto-syncs on sign-in and when the app returns to the foreground; exposes status to screens. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, ownerConflict, journalReady, refreshProfile } = useAuth();
  const scope = isSupabaseConfigured && user?.id && journalReady && !ownerConflict ? user.id : null;
  const [state, dispatch] = useReducer(syncReducer, initialSyncState(scope));
  const current = state.scope === scope ? state : initialSyncState(scope);
  const inFlight = useRef<{ scope: string; request: number; promise: Promise<SyncResult | null> } | null>(null);
  const sequence = useRef(0);
  const [pending, setPending] = useState<number | null>(null);
  const lastAuto = useRef(0);

  const refreshPending = useCallback(async () => {
    setPending(await countPendingSync().catch(() => null));
  }, []);

  const syncNow = useCallback(async () => {
    if (!scope) return null;
    if (inFlight.current?.scope === scope) return inFlight.current.promise;
    const request = ++sequence.current;
    dispatch({ type: 'start', scope, request });
    const promise = (async () => {
      try {
        const result = await syncAll(scope);
        dispatch({ type: 'finished', scope, request, result, at: new Date().toISOString() });
        if (inFlight.current?.request === request && (result.pushed.track_points || result.pushed.trips)) {
          void refreshProfile();
        }
        return result;
      } catch (e) {
        dispatch({ type: 'failed', scope, request, error: e instanceof Error ? e.message : 'Sync failed' });
        return null;
      } finally {
        if (inFlight.current?.request === request) inFlight.current = null;
        void refreshPending();
      }
    })();
    inFlight.current = { scope, request, promise };
    return promise;
  }, [scope, refreshProfile, refreshPending]);

  useEffect(() => {
    inFlight.current = null;
    dispatch({ type: 'reset', scope });
  }, [scope]);

  useEffect(() => {
    refreshPending();
    if (!user?.id || !journalReady || ownerConflict) return;
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
  }, [user?.id, journalReady, ownerConflict, syncNow, refreshPending]);

  return (
    <SyncContext.Provider value={{ phase: current.phase, syncing: current.phase === 'syncing', lastSyncAt: current.lastSyncAt, lastErrors: current.errors, pending, syncNow, refreshPending }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync outside SyncProvider');
  return ctx;
}

