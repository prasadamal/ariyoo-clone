import { Share } from 'react-native';
import { v4 as uuid } from 'uuid';
import { getShareBaseUrl, isSupabaseConfigured } from '../config';
import { supabase } from './supabase';
import { updateTrip, type LocalTrip } from './localDb';

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
  author?: { display_name: string; username: string | null; tier: string };
  stats?: { route_km: number; entry_count: number };
  route?: [number, number][];
  entries: Array<{
    recorded_at: string;
    body: string | null;
    mood: string | null;
    place_name: string | null;
    weather: string | null;
  }>;
};

export async function fetchSharedTrip(shareId: string): Promise<SharedTripPayload | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('get_shared_trip', { p_share_id: shareId });
  if (error || !data) return null;
  return data as SharedTripPayload;
}
