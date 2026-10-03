import { isSupabaseConfigured } from '../config';
import { supabase } from './supabase';
import { getDb, listTrips, type LocalTrip } from './localDb';

/** Push pending local trips to Supabase when online and signed in. */
export async function syncTripsToCloud(userId: string): Promise<{ synced: number; errors: string[] }> {
  if (!isSupabaseConfigured || !supabase) {
    return { synced: 0, errors: ['Supabase not configured'] };
  }
  const trips = await listTrips();
  const pending = trips.filter(t => t.sync_status === 'pending');
  const errors: string[] = [];
  let synced = 0;

  for (const trip of pending) {
    const { error } = await supabase.from('trips').upsert({
      id: trip.id,
      user_id: userId,
      title: trip.title,
      trip_type: trip.trip_type,
      destination: trip.destination,
      starts_on: trip.starts_on,
      ends_on: trip.ends_on,
      visibility: trip.visibility,
      companions: trip.companions,
      status: trip.status,
      notes: trip.notes,
      updated_at: trip.updated_at,
    });
    if (error) {
      errors.push(error.message);
      continue;
    }
    const db = await getDb();
    await db.runAsync('UPDATE trips SET sync_status = ? WHERE id = ?', ['synced', trip.id]);
    synced++;
  }
  return { synced, errors };
}

export function mapTripRow(t: LocalTrip) {
  return t;
}
