/**
 * Which messages the signed-in member has saved, and which are mid-request. Pure: the store in
 * savedAnswers.ts applies these transitions, and tests run them alone.
 */
export type SavedState = { owner: number | null; ids: Set<number>; pending: Set<number> };

export const initialSaved = (owner: number | null): SavedState => ({ owner, ids: new Set(), pending: new Set() });

/** Optimistic toggle. Null when nobody is signed in or this message already has a request running. */
export function startToggle(state: SavedState, id: number): { next: SavedState; saving: boolean } | null {
  if (state.owner === null || state.pending.has(id)) return null;
  const saving = !state.ids.has(id);
  const ids = new Set(state.ids);
  if (saving) ids.add(id);
  else ids.delete(id);
  return { next: { ...state, ids, pending: new Set(state.pending).add(id) }, saving };
}

/** The server answered. A reply for another account is ignored; a failure puts it back. */
export function settleToggle(state: SavedState, owner: number, id: number, saving: boolean, ok: boolean): SavedState {
  if (state.owner !== owner) return state;
  const pending = new Set(state.pending);
  pending.delete(id);
  const ids = new Set(state.ids);
  if (!ok) {
    if (saving) ids.delete(id);
    else ids.add(id);
  }
  return { ...state, ids, pending };
}

/** A fresh list from the server, unless it belongs to another account. Mid-request ids keep their local value. */
export function replaceSaved(state: SavedState, owner: number, ids: number[]): SavedState {
  if (state.owner !== owner) return state;
  const next = new Set(ids);
  for (const id of state.pending) {
    if (state.ids.has(id)) next.add(id);
    else next.delete(id);
  }
  return { ...state, ids: next };
}
