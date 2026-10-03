import { Share } from 'react-native';
import { getShareBaseUrl, isSupabaseConfigured } from '../config';
import { newShareId } from './id';
import { getTrip, upsertTrip, type LocalTrip } from './localDb';
import { supabase } from './supabase';
import { syncAll } from './sync';
import { isValidShareId } from './validation';

export function buildShareUrls(shareId: string) {
  return {
    web: `${getShareBaseUrl()}?id=${encodeURIComponent(shareId)}`,
    app: `wayfare://share/${shareId}`,
  };
}

export class ShareError extends Error {}

/** Turns link-sharing on, pushes the trip to the cloud, then opens the share sheet. */
export async function shareTripLink(trip: LocalTrip, userId: string | null) {
  if (!isSupabaseConfigured || !userId) throw new ShareError('Sign in to share a trip — links are served from your cloud backup.');

  const shareId = trip.share_id && isValidShareId(trip.share_id) ? trip.share_id : newShareId();
  await upsertTrip({ ...trip, share_id: shareId, visibility: 'link', sync_status: 'pending', updated_at: new Date().toISOString() });

  // The link only works once the cloud has the trip, so sync before handing it out.
  const result = await syncAll(userId);
  if (result.skipped === 'offline') throw new ShareError('You are offline. Connect to the internet to create a share link.');
  const fresh = await getTrip(trip.id);
  if (fresh?.sync_status === 'pending') {
    throw new ShareError('Could not upload this trip yet. Please try again in a moment.');
  }

  const { web, app } = buildShareUrls(shareId);
  await Share.share({
    message: `Read my Wayfare journey: ${trip.title}\n\n${web}\n\nOpen in the app: ${app}`,
    title: trip.title,
  });
  return shareId;
}

/** Turns sharing off locally; the next sync disables the link in the cloud. */
export async function stopSharingTrip(trip: LocalTrip, userId: string | null) {
  await upsertTrip({ ...trip, share_id: null, visibility: 'private', sync_status: 'pending', updated_at: new Date().toISOString() });
  if (userId) await syncAll(userId);
}

export type SharedTripPayload = {
  trip: {
    title: string;
    destination: string | null;
    trip_type: string;
    starts_on: string | null;
    ends_on: string | null;
    notes: string | null;
  };
  entries: Array<{
    recorded_at: string;
    body: string | null;
    mood: string | null;
    place_name: string | null;
    weather: string | null;
  }>;
};

export async function fetchSharedTrip(shareId: string): Promise<SharedTripPayload | null> {
  if (!isSupabaseConfigured || !supabase || !isValidShareId(shareId)) return null;
  const { data, error } = await supabase.rpc('get_shared_trip', { p_share_id: shareId });
  if (error || !data) return null;
  return data as SharedTripPayload;
}
