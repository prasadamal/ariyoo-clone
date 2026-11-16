import { createJournalGate } from './journalGate';
import { revokeLiveShare, acknowledgeLivePush } from './liveShareLifecycle';
import { getLiveShareBaseUrl } from '../config';
import { getLiveShareState, setLiveShareState, type LiveShareState } from './locationState';
import { supabase } from './supabase';

const withLiveShareLock = createJournalGate();
const PUSH_EVERY_MS = 60_000;

export function buildLiveShareUrls(id: string) {
  return {
    web: `${getLiveShareBaseUrl()}?id=${encodeURIComponent(id)}`,
    app: `wayfare://live/${id}`,
  };
}

/** Creates the cloud row behind a live-location link. */
async function createLiveShareLocked(params: {
  hours: number;
  label: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
}): Promise<LiveShareState> {
  if (!supabase) throw new Error('Live location needs a Wayfare account');
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Sign in to share your live location');
  const hours = Math.min(Math.max(params.hours, 0.5), 72);
  const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('live_shares')
    .insert({
      user_id: userId,
      label: params.label,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy_m: params.accuracy,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single();
  if (error) throw new Error(error.message);
  const state: LiveShareState = {
    id: data.id,
    label: params.label,
    expiresAt: data.expires_at,
    lastPushAt: new Date().toISOString(),
  };
  await setLiveShareState(state);
  return state;
}

/** Called from the location task; throttled so a trek does not drain data or battery. */
async function pushLiveLocationLocked(loc: { latitude: number; longitude: number; accuracy: number | null }) {
  const state = await getLiveShareState();
  if (!state || !supabase) return;
  if (state.lastPushAt && Date.now() - new Date(state.lastPushAt).getTime() < PUSH_EVERY_MS) return;
  const { data, error } = await supabase
    .from('live_shares')
    .update({ latitude: loc.latitude, longitude: loc.longitude, accuracy_m: loc.accuracy })
    .eq('id', state.id).select('id').maybeSingle();
  if (!error && data) await acknowledgeLivePush({ read: getLiveShareState, write: setLiveShareState }, state.id, new Date().toISOString());
}

/** Ends sharing now: the link shows "sharing ended" instead of a position. */
async function endLiveShareLocked() {
  await revokeLiveShare({
    read: getLiveShareState,
    write: setLiveShareState,
    expire: async id => {
      if (!supabase) throw new Error('Reconnect to Wayfare to end this live link.');
      const { data, error } = await supabase.from('live_shares')
        .update({ expires_at: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
      if (error || !data) throw new Error('Could not confirm that sharing ended. Reconnect with the account that created this link and retry.');
    },
  });
}

export type LiveShareView = {
  label: string | null;
  display_name: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  updated_at: string;
  expires_at: string;
  active: boolean;
};

export async function fetchLiveShare(id: string): Promise<LiveShareView | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_live_share', { p_id: id });
  if (error || !data) return null;
  return data as LiveShareView;
}

// Serialize create/push/end so a completed push cannot restore a revoked link.
export function createLiveShare(params: Parameters<typeof createLiveShareLocked>[0]) {
  return withLiveShareLock(() => createLiveShareLocked(params));
}
export function pushLiveLocation(loc: Parameters<typeof pushLiveLocationLocked>[0]) {
  return withLiveShareLock(() => pushLiveLocationLocked(loc));
}
export function endLiveShare() {
  return withLiveShareLock(endLiveShareLocked);
}
