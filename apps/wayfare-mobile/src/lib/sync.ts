import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '../config';
import { ENTRY_MEDIA_BUCKET, uploadEntryMedia } from './media';
import { supabase } from './supabase';
import { shouldApplyRemote } from './syncRules';
import {
  clearTombstone,
  getDb,
  getRowMeta,
  insertTrackPoint,
  listPending,
  listPendingTrackPoints,
  listTombstones,
  markSynced,
  markTrackPointsSynced,
  removeSyncedRowsNotIn,
  removeSyncedTripsNotIn,
  tombstonedIds,
  upsertEntry,
  upsertEntryMedia,
  upsertExpense,
  upsertItineraryItem,
  upsertPackingItem,
  upsertTrip,
  type LocalEntry,
  type LocalEntryMedia,
  type LocalExpense,
  type LocalItineraryItem,
  type LocalPackingItem,
  type LocalTrip,
  type SyncedTable,
} from './localDb';

export type SyncResult = {
  pushed: Record<string, number>;
  pulled: Record<string, number>;
  removed: number;
  errors: string[];
  /** True when the local journal belongs to a different account (nothing was synced). */
  ownerConflict?: boolean;
};

const OWNER_KEY = 'wayfare_local_owner_v1';
const TRACK_CURSOR_KEY = 'wayfare_track_pull_cursor_v1';
const PAGE = 1000;
const PUSH_CHUNK = 100;
const TRACK_BATCH = 300;

export async function getLocalOwner() {
  return AsyncStorage.getItem(OWNER_KEY);
}

export async function setLocalOwner(userId: string | null) {
  if (userId) await AsyncStorage.setItem(OWNER_KEY, userId);
  else await AsyncStorage.removeItem(OWNER_KEY);
  await AsyncStorage.removeItem(TRACK_CURSOR_KEY);
}

export { shouldApplyRemote };

// --- row mappers -------------------------------------------------------------

const tripToRemote = (t: LocalTrip, userId: string) => ({
  id: t.id,
  user_id: userId,
  title: t.title,
  trip_type: t.trip_type,
  destination: t.destination,
  starts_on: t.starts_on || null,
  ends_on: t.ends_on || null,
  visibility: t.visibility,
  companions: t.companions,
  status: t.status,
  notes: t.notes,
  share_id: t.share_id,
  place_key: t.place_key,
  open_to_meet: t.open_to_meet === 1,
  currency: t.currency || 'INR',
  budget_total: t.budget_total,
  dest_lat: t.dest_lat,
  dest_lng: t.dest_lng,
  updated_at: t.updated_at,
});

const tripFromRemote = (r: Record<string, any>): LocalTrip => ({
  id: r.id,
  title: r.title,
  trip_type: r.trip_type,
  destination: r.destination,
  starts_on: r.starts_on,
  ends_on: r.ends_on,
  visibility: r.visibility,
  companions: r.companions,
  status: r.status,
  notes: r.notes,
  share_id: r.share_id ?? null,
  place_key: r.place_key ?? null,
  open_to_meet: r.open_to_meet ? 1 : 0,
  currency: r.currency ?? 'INR',
  budget_total: r.budget_total == null ? null : Number(r.budget_total),
  dest_lat: r.dest_lat ?? null,
  dest_lng: r.dest_lng ?? null,
  sync_status: 'synced',
  updated_at: r.updated_at,
});

const entryToRemote = (e: LocalEntry, userId: string) => ({
  id: e.id,
  trip_id: e.trip_id,
  user_id: userId,
  recorded_at: e.recorded_at,
  body: e.body,
  mood: e.mood,
  place_name: e.place_name,
  weather: e.weather,
  latitude: e.latitude,
  longitude: e.longitude,
  altitude_m: e.altitude_m,
  updated_at: e.updated_at,
});

const entryFromRemote = (r: Record<string, any>): LocalEntry => ({
  id: r.id,
  trip_id: r.trip_id,
  recorded_at: r.recorded_at,
  body: r.body,
  mood: r.mood,
  place_name: r.place_name,
  weather: r.weather,
  latitude: r.latitude ?? null,
  longitude: r.longitude ?? null,
  altitude_m: r.altitude_m ?? null,
  sync_status: 'synced',
  updated_at: r.updated_at,
});

const expenseToRemote = (e: LocalExpense, userId: string) => {
  let split: string[] = [];
  try {
    const parsed = JSON.parse(e.split_with || '[]');
    if (Array.isArray(parsed)) split = parsed.map(String);
  } catch {
    split = [];
  }
  return {
    id: e.id,
    trip_id: e.trip_id,
    user_id: userId,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    note: e.note,
    spent_on: e.spent_on,
    paid_by: e.paid_by,
    split_with: split,
    updated_at: e.updated_at,
  };
};

const expenseFromRemote = (r: Record<string, any>): LocalExpense => ({
  id: r.id,
  trip_id: r.trip_id,
  category: r.category,
  amount: Number(r.amount),
  currency: r.currency,
  note: r.note,
  spent_on: r.spent_on,
  paid_by: r.paid_by ?? null,
  split_with: JSON.stringify(Array.isArray(r.split_with) ? r.split_with : []),
  sync_status: 'synced',
  updated_at: r.updated_at ?? r.created_at,
});

const packingToRemote = (p: LocalPackingItem, userId: string) => ({
  id: p.id,
  trip_id: p.trip_id,
  user_id: userId,
  label: p.label,
  packed: p.packed === 1,
  sort_order: p.sort_order,
  updated_at: p.updated_at,
});

const packingFromRemote = (r: Record<string, any>): LocalPackingItem => ({
  id: r.id,
  trip_id: r.trip_id,
  label: r.label,
  packed: r.packed ? 1 : 0,
  sort_order: r.sort_order,
  sync_status: 'synced',
  updated_at: r.updated_at ?? r.created_at,
});

const itineraryToRemote = (i: LocalItineraryItem, userId: string) => ({
  id: i.id,
  trip_id: i.trip_id,
  user_id: userId,
  day_index: i.day_index,
  title: i.title,
  notes: i.notes,
  start_time: i.start_time,
  place_name: i.place_name,
  done: i.done === 1,
  sort_order: i.sort_order,
  updated_at: i.updated_at,
});

const itineraryFromRemote = (r: Record<string, any>): LocalItineraryItem => ({
  id: r.id,
  trip_id: r.trip_id,
  day_index: r.day_index,
  title: r.title,
  notes: r.notes,
  start_time: r.start_time,
  place_name: r.place_name,
  done: r.done ? 1 : 0,
  sort_order: r.sort_order,
  sync_status: 'synced',
  updated_at: r.updated_at,
});

// --- generic push / pull -------------------------------------------------------

type RowWithMeta = { id: string; updated_at: string };

async function pushTable<T extends RowWithMeta>(
  table: Exclude<SyncedTable, 'entry_media'>,
  toRemote: (row: T, userId: string) => Record<string, unknown>,
  userId: string,
  result: SyncResult,
  key: string
) {
  const pending = await listPending<T>(table);
  for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
    const chunk = pending.slice(i, i + PUSH_CHUNK);
    const { error } = await supabase!.from(table).upsert(chunk.map(r => toRemote(r, userId)));
    if (!error) {
      for (const row of chunk) await markSynced(table, row.id, row.updated_at);
      result.pushed[key] += chunk.length;
      continue;
    }
    // Isolate the bad row(s) so one invalid record cannot block the rest.
    for (const row of chunk) {
      const single = await supabase!.from(table).upsert(toRemote(row, userId));
      if (single.error) {
        result.errors.push(`${key} ${row.id.slice(0, 8)}: ${single.error.message}`);
        continue;
      }
      await markSynced(table, row.id, row.updated_at);
      result.pushed[key]++;
    }
  }
}

async function fetchAll(table: string, select: string, userId: string) {
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from(table)
      .select(select)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Record<string, any>[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function pullTable<T>(
  table: Exclude<SyncedTable, 'trips' | 'entry_media'>,
  fromRemote: (r: Record<string, any>) => T,
  write: (row: T) => Promise<void>,
  userId: string,
  result: SyncResult,
  key: string
) {
  let rows: Record<string, any>[];
  try {
    rows = await fetchAll(table, '*', userId);
  } catch (e) {
    result.errors.push((e as Error).message);
    return;
  }
  const deleted = await tombstonedIds(table);
  for (const r of rows) {
    if (deleted.has(r.id)) continue;
    const local = await getRowMeta(table, r.id);
    if (!shouldApplyRemote(local, r.updated_at ?? r.created_at)) continue;
    await write(fromRemote(r));
    result.pulled[key]++;
  }
  // An empty remote set is more likely a transient auth problem than "everything deleted".
  if (rows.length) {
    result.removed += await removeSyncedRowsNotIn(table, new Set(rows.map(r => r.id as string)));
  }
}

// --- deletes ---------------------------------------------------------------------

async function pushDeletes(result: SyncResult) {
  const tombstones = await listTombstones();
  const storagePaths: { table: SyncedTable; id: string; path: string }[] = [];
  for (const t of tombstones) {
    if (t.storage_path) storagePaths.push({ table: t.table_name, id: t.id, path: t.storage_path });
    const { error } = await supabase!.from(t.table_name).delete().eq('id', t.id);
    if (error) {
      result.errors.push(`delete ${t.table_name}: ${error.message}`);
      continue;
    }
    if (!t.storage_path) await clearTombstone(t.table_name, t.id);
    result.pushed.deletes++;
  }
  if (storagePaths.length) {
    const { error } = await supabase!.storage.from(ENTRY_MEDIA_BUCKET).remove(storagePaths.map(s => s.path));
    if (error) {
      result.errors.push(`delete media files: ${error.message}`);
      return;
    }
    for (const s of storagePaths) await clearTombstone(s.table, s.id);
  }
}

// --- track points ------------------------------------------------------------------

async function pushTrackPoints(userId: string, result: SyncResult) {
  let batch = await listPendingTrackPoints(TRACK_BATCH);
  while (batch.length) {
    const { error } = await supabase!.from('track_points').upsert(
      batch.map(p => ({
        id: p.id,
        trip_id: p.trip_id,
        user_id: userId,
        recorded_at: p.recorded_at,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude_m: p.altitude_m,
        accuracy_m: p.accuracy_m,
      }))
    );
    if (error) {
      result.errors.push(`track points: ${error.message}`);
      return;
    }
    await markTrackPointsSynced(batch.map(b => b.id));
    result.pushed.track_points += batch.length;
    batch = await listPendingTrackPoints(TRACK_BATCH);
  }
}

/** Incremental: only points the cloud received since the last pull (other devices). */
async function pullTrackPoints(userId: string, result: SyncResult) {
  let cursor = (await AsyncStorage.getItem(TRACK_CURSOR_KEY)) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await supabase!
      .from('track_points')
      .select('id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, created_at')
      .eq('user_id', userId)
      .gt('created_at', cursor)
      .order('created_at', { ascending: true })
      .limit(PAGE);
    if (error) {
      result.errors.push(`track points: ${error.message}`);
      return;
    }
    const rows = data ?? [];
    for (const r of rows) {
      await insertTrackPoint(
        {
          id: r.id,
          trip_id: r.trip_id,
          recorded_at: r.recorded_at,
          latitude: r.latitude,
          longitude: r.longitude,
          altitude_m: r.altitude_m,
          accuracy_m: r.accuracy_m,
        },
        'synced'
      );
      result.pulled.track_points++;
    }
    if (rows.length) {
      cursor = rows[rows.length - 1].created_at as string;
      await AsyncStorage.setItem(TRACK_CURSOR_KEY, cursor);
    }
    if (rows.length < PAGE) return;
  }
}

// --- media ------------------------------------------------------------------------

async function pushEntryMedia(userId: string, result: SyncResult) {
  const pending = await listPending<LocalEntryMedia>('entry_media');
  for (const media of pending) {
    if (!media.local_uri) continue;
    try {
      const storagePath =
        media.storage_path ??
        (await uploadEntryMedia({
          userId,
          tripId: media.trip_id,
          mediaId: media.id,
          localUri: media.local_uri,
          mimeType: media.mime_type,
        }));
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
        // Keep the uploaded path so the next attempt only retries the metadata row.
        await upsertEntryMedia({ ...media, storage_path: storagePath });
        result.errors.push(`media ${media.id.slice(0, 8)}: ${error.message}`);
        continue;
      }
      await upsertEntryMedia({ ...media, storage_path: storagePath, sync_status: 'synced' });
      result.pushed.media++;
    } catch (e) {
      result.errors.push(`media ${media.id.slice(0, 8)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function pullEntryMedia(userId: string, result: SyncResult) {
  let rows: Record<string, any>[];
  try {
    rows = await fetchAll('entry_media', '*', userId);
  } catch (e) {
    result.errors.push((e as Error).message);
    return;
  }
  const deleted = await tombstonedIds('entry_media');
  const db = await getDb();
  for (const row of rows) {
    if (deleted.has(row.id)) continue;
    const local = await db.getFirstAsync<{ id: string }>('SELECT id FROM entry_media WHERE id = ?', [row.id]);
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
  if (rows.length) result.removed += await removeSyncedRowsNotIn('entry_media', new Set(rows.map(r => r.id as string)));
}

// --- orchestration --------------------------------------------------------------------

let inFlight: Promise<SyncResult> | null = null;

/** Push local changes (deletes first), pull cloud changes, then upload media. Single-flight. */
export function syncAll(userId: string): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = runSync(userId).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: { trips: 0, entries: 0, expenses: 0, packing: 0, itinerary: 0, track_points: 0, media: 0, deletes: 0 },
    pulled: { trips: 0, entries: 0, expenses: 0, packing: 0, itinerary: 0, track_points: 0, media: 0 },
    removed: 0,
    errors: [],
  };

  if (!isSupabaseConfigured || !supabase) {
    result.errors.push('Cloud sync is not configured');
    return result;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id !== userId) {
    result.errors.push('Sign in again to sync');
    return result;
  }

  const owner = await getLocalOwner();
  if (owner && owner !== userId) {
    result.ownerConflict = true;
    result.errors.push('This device holds journals from another account');
    return result;
  }
  if (!owner) await setLocalOwner(userId);

  await pushDeletes(result);
  await pushTable<LocalTrip>('trips', tripToRemote, userId, result, 'trips');
  await pushTable<LocalEntry>('entries', entryToRemote, userId, result, 'entries');
  await pushTable<LocalExpense>('expenses', expenseToRemote, userId, result, 'expenses');
  await pushTable<LocalPackingItem>('packing_items', packingToRemote, userId, result, 'packing');
  await pushTable<LocalItineraryItem>('itinerary_items', itineraryToRemote, userId, result, 'itinerary');
  await pushTrackPoints(userId, result);

  // Trips first: their children depend on them locally.
  try {
    const remoteTrips = await fetchAll('trips', '*', userId);
    const deleted = await tombstonedIds('trips');
    for (const r of remoteTrips) {
      if (deleted.has(r.id)) continue;
      const local = await getRowMeta('trips', r.id);
      if (!shouldApplyRemote(local, r.updated_at)) continue;
      await upsertTrip(tripFromRemote(r));
      result.pulled.trips++;
    }
    if (remoteTrips.length) result.removed += await removeSyncedTripsNotIn(new Set(remoteTrips.map(r => r.id as string)));
  } catch (e) {
    result.errors.push((e as Error).message);
  }
  await pullTable('entries', entryFromRemote, upsertEntry, userId, result, 'entries');
  await pullTable('expenses', expenseFromRemote, upsertExpense, userId, result, 'expenses');
  await pullTable('packing_items', packingFromRemote, upsertPackingItem, userId, result, 'packing');
  await pullTable('itinerary_items', itineraryFromRemote, upsertItineraryItem, userId, result, 'itinerary');
  await pullTrackPoints(userId, result);
  await pullEntryMedia(userId, result);
  await pushEntryMedia(userId, result);

  // Server-verified stats (distance / altitude / tier) — best effort.
  if (result.pushed.track_points > 0 || result.pushed.trips > 0) {
    await supabase.rpc('refresh_my_stats').then(
      () => undefined,
      () => undefined
    );
  }

  return result;
}

/** Push a single trip right away (e.g. before matching travellers or linking a post). */
export async function pushTripNow(userId: string, tripId: string) {
  if (!supabase) throw new Error('Cloud sync is not configured');
  const db = await getDb();
  const trip = await db.getFirstAsync<LocalTrip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) throw new Error('Trip not found');
  const owner = await getLocalOwner();
  if (owner && owner !== userId) throw new Error('This device holds journals from another account');
  if (!owner) await setLocalOwner(userId);
  const { error } = await supabase.from('trips').upsert(tripToRemote(trip, userId));
  if (error) throw new Error(error.message);
  await markSynced('trips', trip.id, trip.updated_at);
}
