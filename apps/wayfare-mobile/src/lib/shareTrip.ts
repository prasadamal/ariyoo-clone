import { Share } from 'react-native';
import { uuid } from './id';
import { getShareBaseUrl, isSupabaseConfigured, storyLinkUrl } from '../config';
import { pushTripNow, syncAll } from './sync';
import { supabase } from './supabase';
import { countTripPendingUploads, updateTrip, type LocalTrip } from './localDb';
import { storyShareId, type StopOutcome } from './storyLink';

/** Turns on the read-only link (synced on next sync / pushTripNow). */
export async function enableTripShareLink(trip: LocalTrip): Promise<string> {
  const shareId = trip.share_id ?? uuid();
  await updateTrip(trip.id, { share_id: shareId, visibility: 'link' });
  return shareId;
}

export async function disableTripShareLink(trip: LocalTrip) {
  await updateTrip(trip.id, { visibility: 'private' });
}

export function buildShareUrls(shareId: string) {
  const web = `${getShareBaseUrl()}?id=${encodeURIComponent(shareId)}`;
  const app = `wayfare://share/${shareId}`;
  return { web, app };
}

export async function shareTripLink(trip: LocalTrip) {
  const shareId = await enableTripShareLink(trip);
  const { web, app } = buildShareUrls(shareId);
  await Share.share({
    message: `Follow my Wayfare journey: ${trip.title}\n\n${web}\n\nOpen in the app: ${app}`,
    title: `Share ${trip.title}`,
  });
  return shareId;
}

/** @deprecated use shareTripLink */
export const copyShareTrip = shareTripLink;

export type SharedTripPayload = {
  trip: {
    title: string;
    destination: string | null;
    trip_type: string;
    starts_on: string | null;
    ends_on: string | null;
    status?: string;
  };
  author?: { display_name: string; username?: string | null; tier?: string };
  stats?: { route_km: number; entry_count: number };
  route?: [number, number][];
  entries: Array<{
    recorded_at: string;
    body: string | null;
    mood: string | null;
    place_name: string | null;
    weather?: string | null;
  }>;
};

export async function fetchSharedTrip(shareId: string): Promise<SharedTripPayload | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('get_shared_trip', { p_share_id: shareId });
  if (error || !data) return null;
  return data as SharedTripPayload;
}

/**
 * Trip story: a link family can open in a browser. It shows the journey's moments, photos, moods
 * and typed place names; never money, routes, GPS points or voice notes (see get_trip_story).
 * Starting to share makes a fresh link. The journey and its moments are uploaded first, and the
 * link is offered only once the page answers; if it can't be published, sharing is undone.
 */
export async function shareTripStory(trip: LocalTrip, userId: string): Promise<{ url: string; pendingUploads: number }> {
  if (!supabase) throw new Error('Sign in to share a story');
  const wasLive = trip.visibility === 'link' && Boolean(trip.share_id);
  const shareId = storyShareId(trip, uuid);
  await updateTrip(trip.id, { share_id: shareId, visibility: 'link' });
  const sync = await syncAll(userId).catch(() => null);
  const check = await supabase.rpc('get_trip_story', { p_share_id: shareId }).then(r => r, () => ({ data: null, error: true }));
  if (!sync || check.error || !check.data) {
    if (!wasLive) await updateTrip(trip.id, { share_id: trip.share_id, visibility: trip.visibility });
    throw new Error('Couldn\u2019t publish the story. Check your connection and try again.');
  }
  const pendingUploads = await countTripPendingUploads(trip.id);
  const url = storyLinkUrl(shareId);
  await Share.share({ message: `${trip.title} on Wayfare: follow along, day by day.\n${url}`, title: trip.title });
  return { url, pendingUploads };
}

/**
 * Stops the story link. It's 'stopped' only when the server has the change and the page no
 * longer answers; offline it's 'pending' and stops at the next sync.
 */
export async function stopTripStory(trip: LocalTrip, userId: string | null): Promise<StopOutcome> {
  await disableTripShareLink(trip);
  if (!userId || !supabase || !trip.share_id) return 'pending';
  try {
    await pushTripNow(userId, trip.id);
    const { data, error } = await supabase.rpc('get_trip_story', { p_share_id: trip.share_id });
    return !error && !data ? 'stopped' : 'pending';
  } catch {
    return 'pending';
  }
}
