import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countPendingSync,
  getMeta,
  getOwnerId,
  getRow,
  insertRemoteTrackPoints,
  listPending,
  listPendingTrackPoints,
  markSyncedIfUnchanged,
  markTrackPointsSynced,
  purgeRow,
  purgeTombstone,
  purgeTripLocal,
  setMeta,
  upsertEntry,
  upsertEntryMedia,
  upsertExpense,
  upsertPackingItem,
  upsertTrip,
  getDb,
  runInTransaction,
  type LocalEntry,
  type LocalEntryMedia,
  type LocalExpense,
  type LocalPackingItem,
  type LocalTrip,
  type SyncTable,
} from './localDb';
import { kindForMime, normalizeMime } from './mediaTypes';

/**
 * Offline-first sync.
 *
 *  push  pending rows (batched upserts) -> tombstones
 *  pull  rows changed since a per-table server cursor (`updated_at`), paged
 *
 * Conflict rule: a locally-pending row always wins and is pushed over the
 * server copy; everything else takes the server copy. The server stamps
 * `updated_at`, so a wrong device clock cannot hide or overwrite data.
 */

export type SyncResult = {
  pushed: Record<string, number>;
  pulled: Record<string, number>;
  errors: string[];
  skipped?: 'offline' | 'unconfigured' | 'halted';
  finishedAt?: string;
};

export type UploadParams = { userId: string; tripId: string; mediaId: string; localUri: string; mime: string };

export type SyncDeps = {
  client: SupabaseClient | null;
  isOnline(): Promise<boolean>;
  uploadMedia(p: UploadParams): Promise<{ path: string; size: number }>;
  removeRemoteObjects(paths: string[]): Promise<void>;
  deleteLocalFiles(uris: string[]): void;
  fileExists(uri: string): boolean;
};

const PUSH_BATCH = 100;
const PULL_PAGE = 500;
const POINT_PAGE = 1000;
const POINT_PUSH_BATCH = 500;
/** Re-read a little before the cursor so rows committed out of order are never missed. */
const CURSOR_OVERLAP_MS = 2 * 60 * 1000;

function emptyResult(): SyncResult {
  const zero = () => ({ trips: 0, entries: 0, expenses: 0, packing: 0, track_points: 0, media: 0 });
  return { pushed: zero(), pulled: zero(), errors: [] };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Default (production) dependencies, loaded lazily so tests don't need Expo
// ---------------------------------------------------------------------------
async function defaultDeps(): Promise<SyncDeps> {
  const [{ supabase }, media, Network] = await Promise.all([import('./supabase'), import('./media'), import('expo-network')]);
  const { File } = await import('expo-file-system');
  return {
    client: supabase,
    isOnline: async () => {
      try {
        const s = await Network.getNetworkStateAsync();
        return s.isConnected !== false && s.isInternetReachable !== false;
      } catch {
        return true;
      }
    },
    uploadMedia: media.uploadMedia,
    removeRemoteObjects: media.removeRemoteObjects,
    deleteLocalFiles: media.deleteLocalFiles,
    fileExists: uri => {
      try {
        return new File(uri).exists;
      } catch {
        return false;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Single-flight
// ---------------------------------------------------------------------------
let inflight: Promise<SyncResult> | null = null;
let halted = false;

/**
 * Stops syncing and waits for any run in progress. Call before wiping local data
 * (sign-out / account deletion) so a late pull cannot repopulate the device.
 */
export async function haltSync() {
  halted = true;
  if (inflight) await inflight.catch(() => {});
}

export function resumeSync() {
  halted = false;
}

export function isSyncing() {
  return inflight != null;
}

export function syncAll(userId: string, deps?: SyncDeps): Promise<SyncResult> {
  if (inflight) return inflight;
  inflight = run(userId, deps).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function run(userId: string, injected?: SyncDeps): Promise<SyncResult> {
  const result = emptyResult();
  if (halted) {
    result.skipped = 'halted';
    return result;
  }
  // Safety net: local rows may only ever be uploaded to the account that owns them.
  const owner = await getOwnerId();
  if (owner !== userId) {
    result.errors.push('This device holds data for a different account; sync was skipped.');
    return result;
  }
  const deps = injected ?? (await defaultDeps());
  if (!deps.client) {
    result.skipped = 'unconfigured';
    return result;
  }
  if (!(await deps.isOnline())) {
    result.skipped = 'offline';
    return result;
  }

  const steps: [string, () => Promise<void>][] = [
    ['push trips', () => pushLive('trips', deps, userId, result)],
    ['push entries', () => pushLive('entries', deps, userId, result)],
    ['push expenses', () => pushLive('expenses', deps, userId, result)],
    ['push packing', () => pushLive('packing_items', deps, userId, result)],
    ['push route', () => pushTrackPoints(deps, userId, result)],
    ['push media', () => pushMedia(deps, userId, result)],
    ['push deletions', () => pushTombstones(deps, userId, result)],
    ['pull trips', () => pullTable('trips', deps, userId, result)],
    ['pull entries', () => pullTable('entries', deps, userId, result)],
    ['pull expenses', () => pullTable('expenses', deps, userId, result)],
    ['pull packing', () => pullTable('packing_items', deps, userId, result)],
    ['pull media', () => pullTable('entry_media', deps, userId, result)],
    ['pull route', () => pullTrackPoints(deps, userId, result)],
  ];
  for (const [name, step] of steps) {
    if (halted) {
      result.skipped = 'halted';
      break;
    }
    try {
      await step();
    } catch (e) {
      result.errors.push(`${name}: ${msg(e)}`);
    }
  }
  result.finishedAt = new Date().toISOString();
  if (!result.errors.length) await setMeta('last_sync_at', result.finishedAt);
  return result;
}

export async function getLastSyncAt() {
  return getMeta('last_sync_at');
}

export { countPendingSync };

// ---------------------------------------------------------------------------
// Row <-> remote payload mapping
// ---------------------------------------------------------------------------
const REMOTE: Record<SyncTable, string> = {
  trips: 'trips',
  entries: 'entries',
  expenses: 'expenses',
  packing_items: 'packing_items',
  entry_media: 'entry_media',
};

function toRemote(table: SyncTable, row: Record<string, unknown>, userId: string): Record<string, unknown> {
  switch (table) {
    case 'trips': {
      const t = row as unknown as LocalTrip;
      const shared = t.visibility === 'link' && !!t.share_id;
      return {
        id: t.id,
        user_id: userId,
        title: t.title,
        trip_type: t.trip_type,
        destination: t.destination,
        starts_on: t.starts_on,
        ends_on: t.ends_on,
        visibility: shared ? 'link' : 'private',
        companions: t.companions,
        status: t.status,
        notes: t.notes,
        share_id: shared ? t.share_id : null,
        deleted_at: null,
      };
    }
    case 'entries': {
      const e = row as unknown as LocalEntry;
      return {
        id: e.id,
        trip_id: e.trip_id,
        user_id: userId,
        recorded_at: e.recorded_at,
        body: e.body,
        mood: e.mood,
        place_name: e.place_name,
        weather: e.weather,
        deleted_at: null,
      };
    }
    case 'expenses': {
      const x = row as unknown as LocalExpense;
      return {
        id: x.id,
        trip_id: x.trip_id,
        user_id: userId,
        category: x.category,
        amount: x.amount,
        currency: x.currency,
        note: x.note,
        spent_on: x.spent_on,
        deleted_at: null,
      };
    }
    case 'packing_items': {
      const p = row as unknown as LocalPackingItem;
      return {
        id: p.id,
        trip_id: p.trip_id,
        user_id: userId,
        label: p.label,
        packed: p.packed === 1,
        sort_order: p.sort_order,
        deleted_at: null,
      };
    }
    case 'entry_media': {
      const m = row as unknown as LocalEntryMedia;
      return {
        id: m.id,
        trip_id: m.trip_id,
        entry_id: m.entry_id,
        user_id: userId,
        kind: m.kind,
        storage_path: m.storage_path,
        mime_type: m.mime_type,
        size_bytes: m.size_bytes,
        deleted_at: null,
      };
    }
  }
}

const COUNTER: Record<SyncTable, keyof SyncResult['pushed']> = {
  trips: 'trips',
  entries: 'entries',
  expenses: 'expenses',
  packing_items: 'packing',
  entry_media: 'media',
};

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------
async function pushLive(table: SyncTable, deps: SyncDeps, userId: string, result: SyncResult) {
  const rows = await listPending<Record<string, unknown> & { id: string; updated_at: string }>(table, 0);
  for (const batch of chunk(rows, PUSH_BATCH)) {
    const payload = batch.map(r => toRemote(table, r, userId));
    const { error } = await deps.client!.from(REMOTE[table]).upsert(payload);
    if (!error) {
      for (const r of batch) await markSyncedIfUnchanged(table, r.id, r.updated_at);
      result.pushed[COUNTER[table]] += batch.length;
      continue;
    }
    // Isolate a poison row so one bad record cannot block the rest.
    for (const r of batch) {
      const one = await deps.client!.from(REMOTE[table]).upsert(toRemote(table, r, userId));
      if (one.error) {
        result.errors.push(`${table} ${r.id.slice(0, 8)}: ${one.error.message}`);
      } else {
        await markSyncedIfUnchanged(table, r.id, r.updated_at);
        result.pushed[COUNTER[table]] += 1;
      }
    }
  }
}

async function pushTrackPoints(deps: SyncDeps, userId: string, result: SyncResult) {
  for (;;) {
    const batch = await listPendingTrackPoints(POINT_PUSH_BATCH);
    if (!batch.length) return;
    const { error } = await deps.client!.from('track_points').upsert(
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
      // Most likely the parent trip is not in the cloud yet or was deleted; retry next sync.
      result.errors.push(`track_points: ${error.message}`);
      return;
    }
    await markTrackPointsSynced(batch.map(b => b.id));
    result.pushed.track_points += batch.length;
  }
}

async function pushMedia(deps: SyncDeps, userId: string, result: SyncResult) {
  const rows = await listPending<LocalEntryMedia>('entry_media', 0);
  for (const m of rows) {
    try {
      let storagePath = m.storage_path;
      let size = m.size_bytes;
      const mime = normalizeMime(m.mime_type, m.local_uri, m.kind ?? kindForMime(m.mime_type));
      if (!storagePath) {
        if (!m.local_uri || !deps.fileExists(m.local_uri)) {
          await purgeRow('entry_media', m.id); // the file is gone; nothing left to sync
          continue;
        }
        const up = await deps.uploadMedia({
          userId,
          tripId: m.trip_id,
          mediaId: m.id,
          localUri: m.local_uri,
          mime,
        });
        storagePath = up.path;
        size = up.size;
      }
      const payload = { ...toRemote('entry_media', m as unknown as Record<string, unknown>, userId), storage_path: storagePath, mime_type: mime, size_bytes: size };
      const { error } = await deps.client!.from('entry_media').upsert(payload);
      if (error) throw error;
      const db = await getDb();
      await db.runAsync("UPDATE entry_media SET storage_path = ?, mime_type = ?, size_bytes = ? WHERE id = ?", [storagePath, mime, size, m.id]);
      await markSyncedIfUnchanged('entry_media', m.id, m.updated_at);
      result.pushed.media += 1;
    } catch (e) {
      result.errors.push(`media ${m.id.slice(0, 8)}: ${msg(e)}`);
    }
  }
}

async function pushTombstones(deps: SyncDeps, userId: string, result: SyncResult) {
  const client = deps.client!;
  const stamp = () => new Date().toISOString();

  // Children first so a half-finished trip delete can never leave live orphans.
  for (const table of ['entry_media', 'entries', 'expenses', 'packing_items'] as SyncTable[]) {
    const rows = await listPending<{ id: string; updated_at: string; storage_path?: string | null }>(table, 1);
    for (const r of rows) {
      try {
        if (table === 'entry_media' && r.storage_path) await deps.removeRemoteObjects([r.storage_path]);
        // UPDATE (not upsert): a row that never reached the cloud simply matches nothing.
        const { error } = await client.from(REMOTE[table]).update({ deleted_at: stamp() }).eq('id', r.id).eq('user_id', userId);
        if (error) throw error;
        await purgeTombstone(table, r.id, r.updated_at);
        result.pushed[COUNTER[table]] += 1;
      } catch (e) {
        result.errors.push(`delete ${table} ${r.id.slice(0, 8)}: ${msg(e)}`);
      }
    }
  }

  const trips = await listPending<LocalTrip>('trips', 1);
  for (const t of trips) {
    try {
      const { data: media, error: selErr } = await client.from('entry_media').select('storage_path').eq('trip_id', t.id).eq('user_id', userId);
      if (selErr) throw selErr;
      const paths = (media ?? []).map((m: { storage_path: string }) => m.storage_path).filter(Boolean);
      if (paths.length) await deps.removeRemoteObjects(paths);
      for (const child of ['track_points', 'entry_media', 'entries', 'expenses', 'packing_items']) {
        const { error } = await client.from(child).delete().eq('trip_id', t.id).eq('user_id', userId);
        if (error) throw error;
      }
      const { error } = await client.from('trips').update({ deleted_at: stamp(), visibility: 'private', share_id: null }).eq('id', t.id).eq('user_id', userId);
      if (error) throw error;
      await purgeTombstone('trips', t.id, t.updated_at);
      result.pushed.trips += 1;
    } catch (e) {
      result.errors.push(`delete trip ${t.id.slice(0, 8)}: ${msg(e)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------
type RemoteRow = Record<string, any> & { id: string; updated_at: string; deleted_at?: string | null };

async function applyRemote(table: SyncTable, row: RemoteRow, deps: SyncDeps) {
  if (row.deleted_at) {
    if (table === 'trips') deps.deleteLocalFiles(await purgeTripLocal(row.id));
    else {
      if (table === 'entry_media') {
        const local = await getRow<LocalEntryMedia>('entry_media', row.id);
        if (local?.local_uri) deps.deleteLocalFiles([local.local_uri]);
      }
      await purgeRow(table, row.id);
    }
    return;
  }
  const local = await getRow<Record<string, any>>(table, row.id);
  if (local?.sync_status === 'pending') return; // local edit wins; it will be pushed

  const base = { sync_status: 'synced', updated_at: row.updated_at };
  switch (table) {
    case 'trips':
      return upsertTrip({
        ...base,
        id: row.id,
        title: row.title,
        trip_type: row.trip_type,
        destination: row.destination ?? null,
        starts_on: row.starts_on ?? null,
        ends_on: row.ends_on ?? null,
        visibility: row.visibility,
        companions: row.companions ?? null,
        status: row.status,
        notes: row.notes ?? null,
        share_id: row.share_id ?? null,
      });
    case 'entries':
      return upsertEntry({
        ...base,
        id: row.id,
        trip_id: row.trip_id,
        recorded_at: row.recorded_at,
        body: row.body ?? null,
        mood: row.mood ?? null,
        place_name: row.place_name ?? null,
        weather: row.weather ?? null,
      });
    case 'expenses':
      return upsertExpense({
        ...base,
        id: row.id,
        trip_id: row.trip_id,
        category: row.category,
        amount: Number(row.amount),
        currency: row.currency,
        note: row.note ?? null,
        spent_on: row.spent_on ?? null,
      });
    case 'packing_items':
      return upsertPackingItem({
        ...base,
        id: row.id,
        trip_id: row.trip_id,
        label: row.label,
        packed: row.packed ? 1 : 0,
        sort_order: row.sort_order ?? 0,
      });
    case 'entry_media':
      return upsertEntryMedia({
        ...base,
        id: row.id,
        trip_id: row.trip_id,
        entry_id: row.entry_id,
        local_uri: local?.local_uri ?? '',
        storage_path: row.storage_path,
        mime_type: row.mime_type,
        kind: row.kind,
        size_bytes: row.size_bytes ?? null,
      });
  }
}

async function pullTable(table: SyncTable, deps: SyncDeps, userId: string, result: SyncResult) {
  const key = `cursor:${table}`;
  const cursor = await getMeta(key);
  const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
  let newest = cursor;

  for (let from = 0; ; from += PULL_PAGE) {
    let q = deps.client!.from(REMOTE[table]).select('*').eq('user_id', userId);
    if (since) q = q.gte('updated_at', since);
    const { data, error } = await q.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PULL_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as RemoteRow[];
    await runInTransaction(async () => {
      for (const row of rows) await applyRemote(table, row, deps);
    });
    result.pulled[COUNTER[table]] += rows.length;
    for (const r of rows) if (!newest || r.updated_at > newest) newest = r.updated_at;
    if (rows.length < PULL_PAGE) break;
  }
  if (newest) await setMeta(key, newest);
}

async function pullTrackPoints(deps: SyncDeps, userId: string, result: SyncResult) {
  const key = 'cursor:track_points';
  const cursor = await getMeta(key);
  const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
  let newest = cursor;

  for (let from = 0; ; from += POINT_PAGE) {
    let q = deps.client!
      .from('track_points')
      .select('id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, created_at')
      .eq('user_id', userId);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + POINT_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, any>>;
    result.pulled.track_points += await insertRemoteTrackPoints(
      rows.map(r => ({
        id: r.id,
        trip_id: r.trip_id,
        recorded_at: r.recorded_at,
        latitude: r.latitude,
        longitude: r.longitude,
        altitude_m: r.altitude_m ?? null,
        accuracy_m: r.accuracy_m ?? null,
      }))
    );
    for (const r of rows) if (!newest || r.created_at > newest) newest = r.created_at;
    if (rows.length < POINT_PAGE) break;
  }
  if (newest) await setMeta(key, newest);
}
