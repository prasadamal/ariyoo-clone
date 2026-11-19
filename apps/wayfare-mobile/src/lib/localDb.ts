import { labelsToCopy } from './packing';
import { withJournalLock } from './journalGate';
import * as SQLite from 'expo-sqlite';
import { uuid } from './id';

/** Bump when adding a migration step in `migrate()`. */
const SCHEMA_VERSION = 2;

export type LocalTrip = {
  id: string;
  title: string;
  trip_type: string;
  destination: string | null;
  starts_on: string | null;
  ends_on: string | null;
  visibility: string;
  companions: string | null;
  status: string;
  notes: string | null;
  share_id: string | null;
  place_key: string | null;
  open_to_meet: number;
  currency: string;
  budget_total: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  sync_status: string;
  updated_at: string;
};

export type LocalEntry = {
  id: string;
  trip_id: string;
  recorded_at: string;
  body: string | null;
  mood: string | null;
  place_name: string | null;
  weather: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  sync_status: string;
  updated_at: string;
};

export type LocalExpense = {
  id: string;
  trip_id: string;
  category: string;
  amount: number;
  currency: string;
  note: string | null;
  spent_on: string | null;
  /** Companion name who paid, or null for "me". */
  paid_by: string | null;
  /** JSON array of participant names sharing the cost ("Me" included); "[]" = personal. */
  split_with: string;
  sync_status: string;
  updated_at: string;
};

export type LocalPackingItem = {
  id: string;
  trip_id: string;
  label: string;
  packed: number;
  sort_order: number;
  sync_status: string;
  updated_at: string;
};

export type LocalItineraryItem = {
  id: string;
  trip_id: string;
  day_index: number;
  title: string;
  notes: string | null;
  start_time: string | null;
  place_name: string | null;
  done: number;
  sort_order: number;
  sync_status: string;
  updated_at: string;
};

export type LocalTrackPoint = {
  id: string;
  trip_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  accuracy_m: number | null;
  sync_status: string;
};

export type LocalEntryMedia = {
  id: string;
  trip_id: string;
  entry_id: string;
  local_uri: string;
  storage_path: string | null;
  mime_type: string | null;
  sync_status: string;
  updated_at: string;
};

export type SyncedTable = 'trips' | 'entries' | 'expenses' | 'packing_items' | 'itinerary_items' | 'entry_media';

export type Tombstone = {
  table_name: SyncedTable;
  id: string;
  storage_path: string | null;
  deleted_at: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('wayfare.db');
      await migrate(database);
      return database;
    })().catch(e => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function addColumnIfMissing(database: SQLite.SQLiteDatabase, table: string, column: string, ddl: string) {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  // v1 — original journal schema (installs before versioning also land here; all idempotent).
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      trip_type TEXT NOT NULL DEFAULT 'trek',
      destination TEXT,
      starts_on TEXT,
      ends_on TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      companions TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      body TEXT,
      mood TEXT,
      place_name TEXT,
      weather TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      note TEXT,
      spent_on TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS packing_items (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      label TEXT NOT NULL,
      packed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS track_points (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude_m REAL,
      accuracy_m REAL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS entry_media (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      storage_path TEXT,
      mime_type TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
  `);
  await addColumnIfMissing(database, 'trips', 'share_id', 'TEXT');

  // v2 — traveller network fields, itinerary, split expenses, delete tombstones.
  await addColumnIfMissing(database, 'trips', 'place_key', 'TEXT');
  await addColumnIfMissing(database, 'trips', 'open_to_meet', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(database, 'trips', 'currency', "TEXT NOT NULL DEFAULT 'INR'");
  await addColumnIfMissing(database, 'trips', 'budget_total', 'REAL');
  await addColumnIfMissing(database, 'trips', 'dest_lat', 'REAL');
  await addColumnIfMissing(database, 'trips', 'dest_lng', 'REAL');
  await addColumnIfMissing(database, 'entries', 'latitude', 'REAL');
  await addColumnIfMissing(database, 'entries', 'longitude', 'REAL');
  await addColumnIfMissing(database, 'entries', 'altitude_m', 'REAL');
  await addColumnIfMissing(database, 'expenses', 'paid_by', 'TEXT');
  await addColumnIfMissing(database, 'expenses', 'split_with', "TEXT NOT NULL DEFAULT '[]'");
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS itinerary_items (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT NOT NULL,
      day_index INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      notes TEXT,
      start_time TEXT,
      place_name TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deleted_records (
      table_name TEXT NOT NULL,
      id TEXT NOT NULL,
      storage_path TEXT,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (table_name, id)
    );
    CREATE INDEX IF NOT EXISTS entries_trip_idx ON entries (trip_id, recorded_at);
    CREATE INDEX IF NOT EXISTS track_points_trip_idx ON track_points (trip_id, recorded_at);
    CREATE INDEX IF NOT EXISTS entry_media_entry_idx ON entry_media (entry_id);
    CREATE INDEX IF NOT EXISTS itinerary_trip_idx ON itinerary_items (trip_id, day_index, sort_order);
  `);
  // Template packing rows used "<tripId>-pack-<n>" ids, which the cloud (uuid) rejected, so
  // they never synced. Give them real ids and queue them again.
  const badPacking = await database.getAllAsync<{ id: string }>(
    "SELECT id FROM packing_items WHERE id LIKE '%-pack-%'"
  );
  for (const p of badPacking) {
    await database.runAsync("UPDATE packing_items SET id = ?, sync_status = 'pending' WHERE id = ?", [uuid(), p.id]);
  }

  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export async function listTrips(): Promise<LocalTrip[]> {
  const database = await getDb();
  return database.getAllAsync<LocalTrip>('SELECT * FROM trips ORDER BY updated_at DESC');
}

export async function getTrip(id: string): Promise<LocalTrip | null> {
  const database = await getDb();
  return database.getFirstAsync<LocalTrip>('SELECT * FROM trips WHERE id = ?', [id]);
}

export async function upsertTrip(trip: LocalTrip) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO trips (id, title, trip_type, destination, starts_on, ends_on, visibility, companions, status, notes,
       share_id, place_key, open_to_meet, currency, budget_total, dest_lat, dest_lng, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, trip_type=excluded.trip_type, destination=excluded.destination,
       starts_on=excluded.starts_on, ends_on=excluded.ends_on, visibility=excluded.visibility,
       companions=excluded.companions, status=excluded.status, notes=excluded.notes,
       share_id=excluded.share_id, place_key=excluded.place_key, open_to_meet=excluded.open_to_meet,
       currency=excluded.currency, budget_total=excluded.budget_total, dest_lat=excluded.dest_lat,
       dest_lng=excluded.dest_lng, sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      trip.id,
      trip.title,
      trip.trip_type,
      trip.destination,
      trip.starts_on,
      trip.ends_on,
      trip.visibility,
      trip.companions,
      trip.status,
      trip.notes,
      trip.share_id ?? null,
      trip.place_key ?? null,
      trip.open_to_meet ? 1 : 0,
      trip.currency || 'INR',
      trip.budget_total ?? null,
      trip.dest_lat ?? null,
      trip.dest_lng ?? null,
      trip.sync_status,
      trip.updated_at,
    ]
  );
}

/** Applies a local edit and queues it for sync. */
export async function updateTrip(id: string, patch: Partial<LocalTrip>) {
  const trip = await getTrip(id);
  if (!trip) return null;
  const next: LocalTrip = { ...trip, ...patch, id, sync_status: 'pending', updated_at: now() };
  await upsertTrip(next);
  return next;
}

async function tombstone(table: SyncedTable, id: string, storagePath: string | null = null) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO deleted_records (table_name, id, storage_path, deleted_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(table_name, id) DO UPDATE SET deleted_at = excluded.deleted_at`,
    [table, id, storagePath, now()]
  );
}

/** Deletes on this device and queues the cloud delete (children cascade on the server). */
export async function deleteTrip(id: string) {
  const database = await getDb();
  const trip = await getTrip(id);
  const media = await database.getAllAsync<{ id: string; storage_path: string | null }>(
    'SELECT id, storage_path FROM entry_media WHERE trip_id = ?',
    [id]
  );
  // Even a pending trip may have reached the cloud before its latest edit, so always queue
  // the remote delete (deleting a row the cloud never had is a harmless no-op).
  if (trip) await tombstone('trips', id);
  for (const m of media) {
    if (m.storage_path) await tombstone('entry_media', m.id, m.storage_path);
  }
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM entry_media WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM entries WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM expenses WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM packing_items WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM itinerary_items WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM track_points WHERE trip_id = ?', [id]);
    await database.runAsync('DELETE FROM trips WHERE id = ?', [id]);
  });
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export async function listEntries(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalEntry>('SELECT * FROM entries WHERE trip_id = ? ORDER BY recorded_at ASC', [tripId]);
}

export async function listAllEntries() {
  const database = await getDb();
  return database.getAllAsync<LocalEntry>('SELECT * FROM entries ORDER BY recorded_at ASC');
}

export async function getEntry(id: string) {
  const database = await getDb();
  return database.getFirstAsync<LocalEntry>('SELECT * FROM entries WHERE id = ?', [id]);
}

export async function upsertEntry(entry: LocalEntry) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO entries (id, trip_id, recorded_at, body, mood, place_name, weather, latitude, longitude, altitude_m,
       sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET recorded_at=excluded.recorded_at, body=excluded.body, mood=excluded.mood,
       place_name=excluded.place_name, weather=excluded.weather, latitude=excluded.latitude,
       longitude=excluded.longitude, altitude_m=excluded.altitude_m, sync_status=excluded.sync_status,
       updated_at=excluded.updated_at`,
    [
      entry.id,
      entry.trip_id,
      entry.recorded_at,
      entry.body,
      entry.mood,
      entry.place_name,
      entry.weather,
      entry.latitude ?? null,
      entry.longitude ?? null,
      entry.altitude_m ?? null,
      entry.sync_status,
      entry.updated_at,
    ]
  );
}

export async function deleteEntry(id: string) {
  const database = await getDb();
  const media = await database.getAllAsync<LocalEntryMedia>('SELECT * FROM entry_media WHERE entry_id = ?', [id]);
  await tombstone('entries', id);
  for (const m of media) {
    if (m.storage_path) await tombstone('entry_media', m.id, m.storage_path);
  }
  await database.runAsync('DELETE FROM entry_media WHERE entry_id = ?', [id]);
  await database.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalExpense>(
    'SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_on DESC, updated_at DESC',
    [tripId]
  );
}

export async function listAllExpenses() {
  const database = await getDb();
  return database.getAllAsync<LocalExpense>('SELECT * FROM expenses');
}

export async function upsertExpense(expense: LocalExpense) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO expenses (id, trip_id, category, amount, currency, note, spent_on, paid_by, split_with, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, amount=excluded.amount, currency=excluded.currency,
       note=excluded.note, spent_on=excluded.spent_on, paid_by=excluded.paid_by, split_with=excluded.split_with,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      expense.id,
      expense.trip_id,
      expense.category,
      expense.amount,
      expense.currency,
      expense.note,
      expense.spent_on,
      expense.paid_by ?? null,
      expense.split_with || '[]',
      expense.sync_status,
      expense.updated_at,
    ]
  );
}

export async function deleteExpense(id: string) {
  const database = await getDb();
  await tombstone('expenses', id);
  await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

export async function listPacking(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalPackingItem>(
    'SELECT * FROM packing_items WHERE trip_id = ? ORDER BY sort_order ASC, label ASC',
    [tripId]
  );
}

export async function upsertPackingItem(item: LocalPackingItem) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO packing_items (id, trip_id, label, packed, sort_order, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label=excluded.label, packed=excluded.packed, sort_order=excluded.sort_order,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [item.id, item.trip_id, item.label, item.packed, item.sort_order, item.sync_status, item.updated_at]
  );
}

export async function addPackingItem(tripId: string, label: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) as m FROM packing_items WHERE trip_id = ?',
    [tripId]
  );
  await upsertPackingItem({
    id: uuid(),
    trip_id: tripId,
    label: label.trim(),
    packed: 0,
    sort_order: (row?.m ?? -1) + 1,
    sync_status: 'pending',
    updated_at: now(),
  });
}

export async function deletePackingItem(id: string) {
  const database = await getDb();
  await tombstone('packing_items', id);
  await database.runAsync('DELETE FROM packing_items WHERE id = ?', [id]);
}

export async function seedPackingTemplate(tripId: string, labels: string[]) {
  const stamp = now();
  for (let i = 0; i < labels.length; i++) {
    await upsertPackingItem({
      id: uuid(),
      trip_id: tripId,
      label: labels[i],
      packed: 0,
      sort_order: i,
      sync_status: 'pending',
      updated_at: stamp,
    });
  }
}

/** Other trips that have a packing list, newest first, for "copy from a past trip". */
export async function listPackingSources(excludeTripId: string) {
  const database = await getDb();
  return database.getAllAsync<{ id: string; title: string; items: number }>(
    `SELECT t.id, t.title, COUNT(p.id) AS items FROM trips t JOIN packing_items p ON p.trip_id = t.id
     WHERE t.id <> ? GROUP BY t.id, t.title ORDER BY MAX(t.updated_at) DESC LIMIT 15`,
    [excludeTripId]
  );
}

/** Adds the source trip's items this trip does not have yet, unpacked, after the existing ones. */
export async function copyPackingFrom(sourceTripId: string, targetTripId: string): Promise<number> {
  const [source, target] = await Promise.all([listPacking(sourceTripId), listPacking(targetTripId)]);
  const labels = labelsToCopy(target.map(i => i.label), source.map(i => i.label));
  const start = target.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1;
  const stamp = now();
  for (let i = 0; i < labels.length; i++) {
    await upsertPackingItem({
      id: uuid(),
      trip_id: targetTripId,
      label: labels[i],
      packed: 0,
      sort_order: start + i,
      sync_status: 'pending',
      updated_at: stamp,
    });
  }
  return labels.length;
}

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------

export async function listItinerary(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalItineraryItem>(
    `SELECT * FROM itinerary_items WHERE trip_id = ?
     ORDER BY day_index ASC, CASE WHEN start_time IS NULL THEN 1 ELSE 0 END, start_time ASC, sort_order ASC`,
    [tripId]
  );
}

export async function upsertItineraryItem(item: LocalItineraryItem) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO itinerary_items (id, trip_id, day_index, title, notes, start_time, place_name, done, sort_order,
       sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET day_index=excluded.day_index, title=excluded.title, notes=excluded.notes,
       start_time=excluded.start_time, place_name=excluded.place_name, done=excluded.done,
       sort_order=excluded.sort_order, sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      item.id,
      item.trip_id,
      item.day_index,
      item.title,
      item.notes,
      item.start_time,
      item.place_name,
      item.done,
      item.sort_order,
      item.sync_status,
      item.updated_at,
    ]
  );
}

export async function deleteItineraryItem(id: string) {
  const database = await getDb();
  await tombstone('itinerary_items', id);
  await database.runAsync('DELETE FROM itinerary_items WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Track points
// ---------------------------------------------------------------------------

export async function countTrackPoints(tripId: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM track_points WHERE trip_id = ?', [
    tripId,
  ]);
  return row?.c ?? 0;
}

export async function insertTrackPoint(point: Omit<LocalTrackPoint, 'sync_status'>, syncStatus = 'pending') {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR IGNORE INTO track_points (id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      point.id,
      point.trip_id,
      point.recorded_at,
      point.latitude,
      point.longitude,
      point.altitude_m,
      point.accuracy_m,
      syncStatus,
    ]
  );
}

export async function listTrackPoints(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalTrackPoint>(
    'SELECT * FROM track_points WHERE trip_id = ? ORDER BY recorded_at ASC',
    [tripId]
  );
}

/** @deprecated use listTrackPoints */
export const listTrackPointsForExport = listTrackPoints;

export async function listAllTrackPoints() {
  const database = await getDb();
  return database.getAllAsync<LocalTrackPoint>('SELECT * FROM track_points ORDER BY trip_id, recorded_at ASC');
}

// ---------------------------------------------------------------------------
// Entry media (photos + voice notes)
// ---------------------------------------------------------------------------

export async function listEntryMedia(entryId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalEntryMedia>('SELECT * FROM entry_media WHERE entry_id = ? ORDER BY updated_at ASC', [
    entryId,
  ]);
}

export async function listTripMedia(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalEntryMedia>('SELECT * FROM entry_media WHERE trip_id = ? ORDER BY updated_at ASC', [
    tripId,
  ]);
}

export async function countAllMedia() {
  const database = await getDb();
  const row = await database.getFirstAsync<{ photos: number; voice: number }>(
    `SELECT
       SUM(CASE WHEN mime_type LIKE 'audio%' THEN 0 ELSE 1 END) as photos,
       SUM(CASE WHEN mime_type LIKE 'audio%' THEN 1 ELSE 0 END) as voice
     FROM entry_media`
  );
  return { photos: row?.photos ?? 0, voice: row?.voice ?? 0 };
}

export async function upsertEntryMedia(media: LocalEntryMedia) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO entry_media (id, trip_id, entry_id, local_uri, storage_path, mime_type, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       local_uri=excluded.local_uri, storage_path=excluded.storage_path, mime_type=excluded.mime_type,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      media.id,
      media.trip_id,
      media.entry_id,
      media.local_uri,
      media.storage_path,
      media.mime_type,
      media.sync_status,
      media.updated_at,
    ]
  );
}

export async function deleteEntryMedia(id: string) {
  const database = await getDb();
  const media = await database.getFirstAsync<LocalEntryMedia>('SELECT * FROM entry_media WHERE id = ?', [id]);
  if (media?.storage_path) await tombstone('entry_media', id, media.storage_path);
  else await tombstone('entry_media', id);
  await database.runAsync('DELETE FROM entry_media WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Sync bookkeeping
// ---------------------------------------------------------------------------

export async function listPending<T>(table: SyncedTable): Promise<T[]> {
  const database = await getDb();
  return database.getAllAsync<T>(`SELECT * FROM ${table} WHERE sync_status = 'pending'`);
}

export async function listPendingTrackPoints(limit = 500) {
  const database = await getDb();
  return database.getAllAsync<LocalTrackPoint>(
    `SELECT * FROM track_points WHERE sync_status = 'pending' ORDER BY recorded_at ASC LIMIT ?`,
    [limit]
  );
}

/** Marks a row synced only if it was not edited again while the upload was in flight. */
export async function markSynced(table: SyncedTable, id: string, updatedAt?: string) {
  const database = await getDb();
  if (updatedAt) {
    await database.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ? AND updated_at = ?`, [
      id,
      updatedAt,
    ]);
  } else {
    await database.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`, [id]);
  }
}

export async function markTrackPointsSynced(ids: string[]) {
  if (!ids.length) return;
  const database = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(`UPDATE track_points SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids);
}

export async function listTombstones() {
  const database = await getDb();
  return database.getAllAsync<Tombstone>('SELECT * FROM deleted_records ORDER BY deleted_at ASC');
}

export async function clearTombstone(table: SyncedTable, id: string) {
  const database = await getDb();
  await database.runAsync('DELETE FROM deleted_records WHERE table_name = ? AND id = ?', [table, id]);
}

export async function tombstonedIds(table: SyncedTable) {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM deleted_records WHERE table_name = ?', [
    table,
  ]);
  return new Set(rows.map(r => r.id));
}

export async function getRowMeta(table: SyncedTable, id: string) {
  const database = await getDb();
  return database.getFirstAsync<{ sync_status: string; updated_at: string }>(
    `SELECT sync_status, updated_at FROM ${table} WHERE id = ?`,
    [id]
  );
}

/** Removes synced rows the cloud no longer has (deleted on another device). */
export async function removeSyncedRowsNotIn(table: Exclude<SyncedTable, 'trips'>, keepIds: Set<string>) {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string }>(`SELECT id FROM ${table} WHERE sync_status = 'synced'`);
  let removed = 0;
  for (const r of rows) {
    if (!keepIds.has(r.id)) {
      await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [r.id]);
      removed++;
    }
  }
  return removed;
}

/** Trips deleted elsewhere: remove them (and their children) locally. */
export async function removeSyncedTripsNotIn(keepIds: Set<string>) {
  const database = await getDb();
  const rows = await database.getAllAsync<{ id: string }>("SELECT id FROM trips WHERE sync_status = 'synced'");
  let removed = 0;
  for (const r of rows) {
    if (keepIds.has(r.id)) continue;
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM entry_media WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM entries WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM expenses WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM packing_items WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM itinerary_items WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM track_points WHERE trip_id = ?', [r.id]);
      await database.runAsync('DELETE FROM trips WHERE id = ?', [r.id]);
    });
    removed++;
  }
  return removed;
}

export async function countPendingSync() {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>(`
    SELECT (
      (SELECT COUNT(*) FROM trips WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM entries WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM expenses WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM packing_items WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM itinerary_items WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM track_points WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM entry_media WHERE sync_status = 'pending') +
      (SELECT COUNT(*) FROM deleted_records)
    ) as c
  `);
  return row?.c ?? 0;
}

/** Wipes the on-device journal (used when another account takes over this device). */
export function wipeLocalData() {
  return withJournalLock(wipeLocalDataLocked);
}
async function wipeLocalDataLocked() {
  const database = await getDb();
  await database.execAsync(`
    DELETE FROM entry_media;
    DELETE FROM entries;
    DELETE FROM expenses;
    DELETE FROM packing_items;
    DELETE FROM itinerary_items;
    DELETE FROM track_points;
    DELETE FROM trips;
    DELETE FROM deleted_records;
  `);
}

export async function countTrips() {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM trips');
  return row?.c ?? 0;
}
