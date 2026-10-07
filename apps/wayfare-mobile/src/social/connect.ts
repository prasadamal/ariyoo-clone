import { coarsen } from '../lib/geo';
import { CommunityError, currentUserId, db, friendly, rpc } from './client';
import type { NearbyTraveller, TripMatch } from './types';

export type MyPresence = {
  lat_coarse: number;
  lng_coarse: number;
  place_label: string | null;
  status_text: string | null;
  expires_at: string;
};

export async function getMyPresence(): Promise<MyPresence | null> {
  const me = await currentUserId();
  const { data, error } = await db()
    .from('presence')
    .select('lat_coarse, lng_coarse, place_label, status_text, expires_at')
    .eq('user_id', me)
    .maybeSingle();
  if (error) throw new CommunityError(friendly(error));
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data as MyPresence;
}

/** Shares an approximate (~1 km grid) position for a few hours. The server coarsens again. */
export async function setPresence(params: {
  latitude: number;
  longitude: number;
  placeLabel?: string | null;
  statusText?: string | null;
  hours: number;
}) {
  const me = await currentUserId();
  const { error } = await db()
    .from('presence')
    .upsert({
      user_id: me,
      lat_coarse: coarsen(params.latitude),
      lng_coarse: coarsen(params.longitude),
      place_label: params.placeLabel?.trim() || null,
      status_text: params.statusText?.trim() || null,
      expires_at: new Date(Date.now() + Math.min(Math.max(params.hours, 0.25), 24) * 3600_000).toISOString(),
    });
  if (error) throw new CommunityError(friendly(error));
}

export async function clearPresence() {
  const me = await currentUserId();
  const { error } = await db().from('presence').delete().eq('user_id', me);
  if (error) throw new CommunityError(friendly(error));
}

export async function nearbyTravellers(latitude: number, longitude: number, radiusKm = 25) {
  return rpc<NearbyTraveller[]>('nearby_travellers', {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_km: radiusKm,
    p_limit: 60,
  });
}

export async function findTripMatches(tripId: string) {
  return rpc<TripMatch[]>('find_trip_matches', { p_trip: tripId });
}
