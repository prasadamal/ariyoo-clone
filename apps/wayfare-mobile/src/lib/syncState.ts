import type { SyncResult } from './sync';

export type SyncState = {
  scope: string | null;
  request: number;
  phase: 'paused' | 'idle' | 'syncing' | 'success' | 'partial' | 'error';
  lastSyncAt: string | null;
  errors: string[];
};

export function initialSyncState(scope: string | null): SyncState {
  return { scope, request: 0, phase: scope ? 'idle' : 'paused', lastSyncAt: null, errors: [] };
}

type Event =
  | { type: 'reset'; scope: string | null }
  | { type: 'start'; scope: string; request: number }
  | { type: 'finished'; scope: string; request: number; result: SyncResult; at: string }
  | { type: 'failed'; scope: string; request: number; error: string };

/** Results from a previous account never describe the current account's sync. */
export function syncReducer(state: SyncState, event: Event): SyncState {
  if (event.type === 'reset') return state.scope === event.scope ? state : initialSyncState(event.scope);
  if (event.scope !== state.scope) return state;
  if (event.type !== 'start' && event.request !== state.request) return state;
  switch (event.type) {
    case 'start': return { ...state, request: event.request, phase: 'syncing', errors: [] };
    case 'finished': {
      const failed = event.result.errors.length > 0 || event.result.ownerConflict;
      return {
        ...state, phase: failed ? 'partial' : 'success', errors: event.result.errors,
        // A partial attempt must not be advertised as the last successful sync.
        lastSyncAt: failed ? state.lastSyncAt : event.at,
      };
    }
    case 'failed': return { ...state, phase: 'error', errors: [event.error] };
  }
}

/** Share work only for the same account; never return another account's result. */
export function createSyncFlight<T>(run: (userId: string) => Promise<T>) {
  let active: { userId: string; promise: Promise<T> } | null = null;
  return (userId: string): Promise<T> => {
    if (active) {
      if (active.userId === userId) return active.promise;
      return Promise.reject(new Error('Another account is still syncing. Please try again shortly.'));
    }
    const promise = Promise.resolve().then(() => run(userId)).finally(() => { active = null; });
    active = { userId, promise };
    return promise;
  };
}
