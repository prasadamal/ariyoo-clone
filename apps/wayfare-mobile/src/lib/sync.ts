import { isSupabaseConfigured } from '../config';
import { uploadEntryPhoto } from './media';
import { supabase } from './supabase';
import {
  getDb,
  getTrip,
  listPendingEntries,
  listPendingEntryMedia,
  listPendingExpenses,
  listPendingPacking,
  listPendingTrackPoints,
  listPendingTrips,
  markSynced,
  markTrackPointsSynced,
  upsertEntry,
  upsertEntryMedia,
  upsertExpense,
  upsertPackingItem,
  upsertTrip,
  type LocalEntry,
  type LocalExpense,
  type LocalPackingItem,
  type LocalTrip,
} from './localDb';

export type SyncResult = {
  pushed: Record<string, number>;
  pulled: Record<string, number>;
  errors: string[];
};

const TRACK_BATCH = 200;

function newer(localIso: string, remoteIso: string) {
  return new Date(remoteIso).getTime() > new Date(localIso).getTime();
}

/** Push pending local rows, pull cloud changes, then push media uploads. */
export async function syncAll(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: { trips: 0, entries: 0, expenses: 0, packing: 0, track_points: 0, media: 0 },
    pulled: { trips: 0, entries: 0, expenses: 0, packing: 0, track_points: 0, media: 0 },
    errors: [],
  };

  if (!isSupabaseConfigured || !supabase) {
    result.errors.push('Supabase not configured');
    return result;
  }

  await pushTrips(userId, result);
  await pushEntries(userId, result);
  await pushExpenses(userId, result);
  await pushPacking(userId, result);
  await pushTrackPoints(userId, result);

  await pullTrips(userId, result);
  await pullEntries(userId, result);
  await pullExpenses(userId, result);
  await pullPacking(userId, result);
  await pullTrackPoints(userId, result);
  await pullEntryMedia(userId, result);

  await pushEntryMedia(userId, result);

  return result;
}

async function pushTrips(userId: string, result: SyncResult) {
  const pending = await listPendingTrips();
  for (const trip of pending) {
    const { error } = await supabase!.from('trips').upsert({
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
      share_id: trip.share_id,
      updated_at: trip.updated_at,
    });
    if (error) {
      result.errors.push(`trip ${trip.id}: ${error.message}`);
      continue;
    }
    await markSynced('trips', trip.id);
    result.pushed.trips++;
  }
}

async function pushEntries(userId: string, result: SyncResult) {
  const pending = await listPendingEntries();
  for (const entry of pending) {
    const trip = await getTrip(entry.trip_id);
    if (!trip) continue;
    const { error } = await supabase!.from('entries').upsert({
      id: entry.id,
      trip_id: entry.trip_id,
      user_id: userId,
      recorded_at: entry.recorded_at,
      body: entry.body,
      mood: entry.mood,
      place_name: entry.place_name,
      weather: entry.weather,
      updated_at: entry.updated_at,
    });
    if (error) {
      result.errors.push(`entry ${entry.id}: ${error.message}`);
      continue;
    }
    await markSynced('entries', entry.id);
    result.pushed.entries++;
  }
}

async function pushExpenses(userId: string, result: SyncResult) {
  const pending = await listPendingExpenses();
  for (const expense of pending) {
    const { error } = await supabase!.from('expenses').upsert({
      id: expense.id,
      trip_id: expense.trip_id,
      user_id: userId,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      note: expense.note,
      spent_on: expense.spent_on,
      updated_at: expense.updated_at,
    });
    if (error) {
      result.errors.push(`expense ${expense.id}: ${error.message}`);
      continue;
    }
    await markSynced('expenses', expense.id);
    result.pushed.expenses++;
  }
}

async function pushPacking(userId: string, result: SyncResult) {
  const pending = await listPendingPacking();
  for (const item of pending) {
    const { error } = await supabase!.from('packing_items').upsert({
      id: item.id,
      trip_id: item.trip_id,
      user_id: userId,
      label: item.label,
      packed: item.packed === 1,
      sort_order: item.sort_order,
      updated_at: item.updated_at,
    });
    if (error) {
      result.errors.push(`packing ${item.id}: ${error.message}`);
      continue;
    }
    await markSynced('packing_items', item.id);
    result.pushed.packing++;
  }
}

async function pushTrackPoints(userId: string, result: SyncResult) {
  let batch = await listPendingTrackPoints(TRACK_BATCH);
  while (batch.length) {
    const rows = batch.map(p => ({
      id: p.id,
      trip_id: p.trip_id,
      user_id: userId,
      recorded_at: p.recorded_at,
      latitude: p.latitude,
      longitude: p.longitude,
      altitude_m: p.altitude_m,
      accuracy_m: p.accuracy_m,
    }));
    const { error } = await supabase!.from('track_points').upsert(rows);
    if (error) {
      result.errors.push(`track_points: ${error.message}`);
      break;
    }
    await markTrackPointsSynced(batch.map(b => b.id));
    result.pushed.track_points += batch.length;
    batch = await listPendingTrackPoints(TRACK_BATCH);
  }
}

async function pushEntryMedia(userId: string, result: SyncResult) {
  const pending = await listPendingEntryMedia();
  for (const media of pending) {
    try {
      const storagePath = await uploadEntryPhoto({
        userId,
        tripId: media.trip_id,
        entryId: media.entry_id,
        mediaId: media.id,
        localUri: media.local_uri,
        mimeType: media.mime_type,
      });
      const { error } = await supabase!.from('entry_media').upsert({
        id: media.id,
        trip_id: media.trip_id,
        entry_id: media.entry_id,
        user_id: userId,
        storage_path: storagePath,
        mime_type: media.mime_type ?? 'image/jpeg',
        updated_at: media.updated_at,
      });
      if (error) {
        result.errors.push(`media meta ${media.id}: ${error.message}`);
        continue;
      }
      await upsertEntryMedia({
        ...media,
        storage_path: storagePath,
        sync_status: 'synced',
      });
      result.pushed.media++;
    } catch (e) {
      result.errors.push(`media ${media.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function pullTrips(userId: string, result: SyncResult) {
  const { data, error } = await supabase!.from('trips').select('*').eq('user_id', userId);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  for (const row of data ?? []) {
    const local = await getTrip(row.id);
    if (local?.sync_status === 'pending') continue;
    const remoteUpdated = row.updated_at as string;
    if (local && !newer(local.updated_at, remoteUpdated)) continue;
    const trip: LocalTrip = {
      id: row.id,
      title: row.title,
      trip_type: row.trip_type,
      destination: row.destination,
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      visibility: row.visibility,
      companions: row.companions,
      status: row.status,
      notes: row.notes,
      share_id: row.share_id ?? null,
      sync_status: 'synced',
      updated_at: remoteUpdated,
    };
    await upsertTrip(trip);
    result.pulled.trips++;
  }
}

async function pullEntries(userId: string, result: SyncResult) {
  const { data, error } = await supabase!.from('entries').select('*').eq('user_id', userId);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  const db = await getDb();
  for (const row of data ?? []) {
    const local = await db.getFirstAsync<LocalEntry>('SELECT * FROM entries WHERE id = ?', [row.id]);
    if (local?.sync_status === 'pending') continue;
    const remoteUpdated = row.updated_at as string;
    if (local && !newer(local.updated_at, remoteUpdated)) continue;
    await upsertEntry({
      id: row.id,
      trip_id: row.trip_id,
      recorded_at: row.recorded_at,
      body: row.body,
      mood: row.mood,
      place_name: row.place_name,
      weather: row.weather,
      sync_status: 'synced',
      updated_at: remoteUpdated,
    });
    result.pulled.entries++;
  }
}

async function pullExpenses(userId: string, result: SyncResult) {
  const { data, error } = await supabase!.from('expenses').select('*').eq('user_id', userId);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  const db = await getDb();
  for (const row of data ?? []) {
    const local = await db.getFirstAsync<LocalExpense>('SELECT * FROM expenses WHERE id = ?', [row.id]);
    if (local?.sync_status === 'pending') continue;
    const remoteUpdated = (row.updated_at as string) ?? row.created_at;
    if (local && remoteUpdated && !newer(local.updated_at, remoteUpdated)) continue;
    await upsertExpense({
      id: row.id,
      trip_id: row.trip_id,
      category: row.category,
      amount: Number(row.amount),
      currency: row.currency,
      note: row.note,
      spent_on: row.spent_on,
      sync_status: 'synced',
      updated_at: remoteUpdated ?? new Date().toISOString(),
    });
    result.pulled.expenses++;
  }
}

async function pullPacking(userId: string, result: SyncResult) {
  const { data, error } = await supabase!.from('packing_items').select('*').eq('user_id', userId);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  const db = await getDb();
  for (const row of data ?? []) {
    const local = await db.getFirstAsync<LocalPackingItem>('SELECT * FROM packing_items WHERE id = ?', [row.id]);
    if (local?.sync_status === 'pending') continue;
    const remoteUpdated = (row.updated_at as string) ?? row.created_at;
    if (local && remoteUpdated && !newer(local.updated_at, remoteUpdated)) continue;
    await upsertPackingItem({
      id: row.id,
      trip_id: row.trip_id,
      label: row.label,
      packed: row.packed ? 1 : 0,
      sort_order: row.sort_order,
      sync_status: 'synced',
      updated_at: remoteUpdated ?? new Date().toISOString(),
    });
    result.pulled.packing++;
  }
}

async function pullTrackPoints(userId: string, result: SyncResult) {
  const { data, error } = await supabase!
    .from('track_points')
    .select('id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true })
    .limit(2000);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  const db = await getDb();
  for (const row of data ?? []) {
    const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM track_points WHERE id = ?', [row.id]);
    if (exists) continue;
    await db.runAsync(
      `INSERT INTO track_points (id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')`,
      [
        row.id,
        row.trip_id,
        row.recorded_at,
        row.latitude,
        row.longitude,
        row.altitude_m,
        row.accuracy_m,
      ]
    );
    result.pulled.track_points++;
  }
}

async function pullEntryMedia(userId: string, result: SyncResult) {
  const { data, error } = await supabase!.from('entry_media').select('*').eq('user_id', userId);
  if (error) {
    result.errors.push(error.message);
    return;
  }
  const db = await getDb();
  for (const row of data ?? []) {
    const local = await db.getFirstAsync<{ sync_status: string }>(
      'SELECT sync_status FROM entry_media WHERE id = ?',
      [row.id]
    );
    if (local?.sync_status === 'pending') continue;
    if (local) continue;
    await upsertEntryMedia({
      id: row.id,
      trip_id: row.trip_id,
      entry_id: row.entry_id,
      local_uri: '',
      storage_path: row.storage_path,
      mime_type: row.mime_type,
      sync_status: 'synced',
      updated_at: row.updated_at ?? row.created_at,
    });
    result.pulled.media++;
  }
}

/** @deprecated use syncAll */
export async function syncTripsToCloud(userId: string) {
  const r = await syncAll(userId);
  return { synced: r.pushed.trips, errors: r.errors };
}
