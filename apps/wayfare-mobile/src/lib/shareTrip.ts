import { Share } from 'react-native';
import { v4 as uuid } from 'uuid';
import { getShareBaseUrl, isSupabaseConfigured } from '../config';
import { supabase } from './supabase';
import { getTrip, upsertTrip, type LocalTrip } from './localDb';

export async function enableTripShareLink(trip: LocalTrip): Promise<string> {
  const shareId = trip.share_id ?? uuid();
  const updated: LocalTrip = {
    ...trip,
    share_id: shareId,
    visibility: 'link',
    sync_status: 'pending',
    updated_at: new Date().toISOString(),
  };
  await upsertTrip(updated);
  return shareId;
}

export function buildShareUrls(shareId: string) {
  const web = `${getShareBaseUrl()}?id=${encodeURIComponent(shareId)}`;
  const app = `wayfare://share/${shareId}`;
  return { web, app };
}

export async function copyShareTrip(trip: LocalTrip) {
  const shareId = await enableTripShareLink(trip);
  const { web, app } = buildShareUrls(shareId);
  await Share.share({
    message: `Read my Wayfare journey: ${trip.title}\n\n${web}\n\nOpen in app: ${app}`,
    title: `Share ${trip.title}`,
  });
  return shareId;
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
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('get_shared_trip', { p_share_id: shareId });
  if (error || !data) return null;
  return data as SharedTripPayload;
}
