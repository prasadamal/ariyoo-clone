import { getLiveShareBaseUrl } from '../config';
import { getLiveShareState, setLiveShareState, type LiveShareState } from './locationState';
import { supabase } from './supabase';

const PUSH_EVERY_MS = 60_000;

export function buildLiveShareUrls(id: string) {
  return {
    web: `${getLiveShareBaseUrl()}?id=${encodeURIComponent(id)}`,
    app: `wayfare://live/${id}`,
  };
}

/** Creates the cloud row behind a live-location link. */
export async function createLiveShare(params: {
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
export async function pushLiveLocation(loc: { latitude: number; longitude: number; accuracy: number | null }) {
  const state = await getLiveShareState();
  if (!state || !supabase) return;
  if (state.lastPushAt && Date.now() - new Date(state.lastPushAt).getTime() < PUSH_EVERY_MS) return;
  const { error } = await supabase
    .from('live_shares')
    .update({ latitude: loc.latitude, longitude: loc.longitude, accuracy_m: loc.accuracy })
    .eq('id', state.id);
  if (!error) await setLiveShareState({ ...state, lastPushAt: new Date().toISOString() });
}

/** Ends sharing now: the link shows "sharing ended" instead of a position. */
export async function endLiveShare() {
  const state = await getLiveShareState();
  await setLiveShareState(null);
  if (state && supabase) {
    await supabase.from('live_shares').update({ expires_at: new Date().toISOString() }).eq('id', state.id);
  }
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
