import { useSyncExternalStore } from 'react';
import { api } from '../api/client';
import { initialSaved, replaceSaved, settleToggle, startToggle, type SavedState } from './savedState';

export type SavedAnswer = {
  messageId: number;
  sessionId: number;
  title: string;
  peerName: string | null;
  fromMe: boolean;
  text: string;
  sentAt: string;
  savedAt: string;
};

export type LibraryResults = {
  query: string;
  questions: { sessionId: number; title: string; peerName: string | null; role: 'seeker' | 'solver'; updatedAt: string }[];
  messages: { messageId: number; sessionId: number; title: string; peerName: string | null; fromMe: boolean; snippet: string; createdAt: string; saved: boolean }[];
};

let state: SavedState = initialSaved(null);
const listeners = new Set<() => void>();
const set = (next: SavedState) => {
  state = next;
  listeners.forEach(l => l());
};

/** Called by the auth context: switching accounts starts from an empty set. */
export function setSavedOwner(owner: number | null) {
  if (state.owner !== owner) set(initialSaved(owner));
}

export function useSaved(): SavedState {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/**
 * Loads the saved list for `owner` and refreshes which messages show as saved. The owner is passed
 * in, not read from the store, because a screen can load before the auth effect has run; a reply
 * that arrives after the account changed is ignored.
 */
export async function loadSaved(owner: number): Promise<SavedAnswer[]> {
  setSavedOwner(owner);
  const { data } = await api.get<{ saved: SavedAnswer[] }>('/api/library/saved');
  set(replaceSaved(state, owner, data.saved.map(s => s.messageId)));
  return data.saved;
}

export async function searchLibrary(q: string): Promise<LibraryResults> {
  const { data } = await api.get<LibraryResults>('/api/library/search', { params: { q } });
  return data;
}

/** Save or unsave. Throws on failure after putting the bookmark back. */
export async function toggleSaved(messageId: number): Promise<void> {
  const owner = state.owner;
  const started = owner === null ? null : startToggle(state, messageId);
  if (!started || owner === null) return;
  set(started.next);
  try {
    if (started.saving) await api.put(`/api/library/saved/${messageId}`);
    else await api.delete(`/api/library/saved/${messageId}`);
    set(settleToggle(state, owner, messageId, started.saving, true));
  } catch (e) {
    set(settleToggle(state, owner, messageId, started.saving, false));
    throw e;
  }
}
