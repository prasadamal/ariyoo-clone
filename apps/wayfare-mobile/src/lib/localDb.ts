import { newId } from './id';

/**
 * Local-first store (SQLite). Every syncable row carries:
 *   sync_status  'pending' | 'synced'
 *   deleted      1 = tombstone waiting to be pushed (hidden from the UI)
 *   updated_at   client time of the last local edit (the server stamps its own)
 */

// ---------------------------------------------------------------------------
// Driver abstraction (expo-sqlite in the app, node:sqlite in unit tests)
// ---------------------------------------------------------------------------
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

const DB_NAME = 'wayfare.db';

let opener: () => Promise<Db> = async () => {
  const SQLite = await import('expo-sqlite');
  return (await SQLite.openDatabaseAsync(DB_NAME)) as unknown as Db;
};
let dbPromise: Promise<Db> | null = null;

/** Test hook: swap the SQLite driver. */
export function setDbOpener(fn: () => Promise<Db>) {
  opener = fn;
  dbPromise = null;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await opener();
      await migrate(db);
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}


let txDepth = 0;

/**
 * Re-entrant transaction: SQLite cannot nest BEGIN, so inner calls join the
 * outer transaction (e.g. a pull page applying a remote trip delete).
 */
export async function runInTransaction(task: () => Promise<void>): Promise<void> {
  const db = await getDb();
  if (txDepth > 0) return task();
  txDepth++;
  try {
    await db.withTransactionAsync(task);
  } finally {
    txDepth--;
  }
}

// ---------------------------------------------------------------------------
// Migrations (PRAGMA user_version)
// ---------------------------------------------------------------------------
async function columnNames(db: Db, table: string) {
  return (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map(c => c.name);
}

async function addColumn(db: Db, table: string, column: string, ddl: string) {
  if (!(await columnNames(db, table)).includes(column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

const MIGRATIONS: ((db: Db) => Promise<void>)[] = [
  // v1: original schema (kept so devices that already ran v1.x upgrade cleanly)
  async db => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, trip_type TEXT NOT NULL DEFAULT 'trek',
        destination TEXT, starts_on TEXT, ends_on TEXT, visibility TEXT NOT NULL DEFAULT 'private',
        companions TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, recorded_at TEXT NOT NULL, body TEXT,
        mood TEXT, place_name TEXT, weather TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR', note TEXT, spent_on TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS packing_items (
        id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, label TEXT NOT NULL,
        packed INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS track_points (
        id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, recorded_at TEXT NOT NULL,
        latitude REAL NOT NULL, longitude REAL NOT NULL, altitude_m REAL, accuracy_m REAL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS entry_media (
        id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, entry_id TEXT NOT NULL,
        local_uri TEXT NOT NULL, storage_path TEXT, mime_type TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL
      );
    `);
    await addColumn(db, 'trips', 'share_id', 'TEXT');
  },
  // v2: tombstones, media kind/size, meta store, indexes, repair non-UUID packing ids
  async db => {
    for (const t of ['trips', 'entries', 'expenses', 'packing_items', 'entry_media']) {
      await addColumn(db, t, 'deleted', 'INTEGER NOT NULL DEFAULT 0');
    }
    await addColumn(db, 'entry_media', 'kind', "TEXT NOT NULL DEFAULT 'photo'");
    await addColumn(db, 'entry_media', 'size_bytes', 'INTEGER');
    await db.execAsync(`
      UPDATE entry_media SET kind = 'audio' WHERE mime_type LIKE 'audio/%';
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
      CREATE INDEX IF NOT EXISTS idx_entries_trip ON entries (trip_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses (trip_id);
      CREATE INDEX IF NOT EXISTS idx_packing_trip ON packing_items (trip_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_points_trip ON track_points (trip_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_points_pending ON track_points (sync_status);
      CREATE INDEX IF NOT EXISTS idx_media_entry ON entry_media (entry_id);
      CREATE INDEX IF NOT EXISTS idx_media_trip ON entry_media (trip_id);
    `);
    // v1.x seeded packing ids like "<tripId>-pack-0", which the cloud (uuid column) rejects.
    const bad = await db.getAllAsync<{ id: string }>("SELECT id FROM packing_items WHERE id LIKE '%-pack-%'");
    for (const row of bad) {
      await db.runAsync("UPDATE packing_items SET id = ?, sync_status = 'pending' WHERE id = ?", [newId(), row.id]);
    }
  },
];

async function migrate(db: Db) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  await db.execAsync('PRAGMA journal_mode = WAL;');
  while (version < MIGRATIONS.length) {
    await MIGRATIONS[version](db);
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SyncStatus = 'pending' | 'synced';

type Sync = { sync_status: string; updated_at: string };

export type LocalTrip = Sync & {
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
};

export type LocalEntry = Sync & {
  id: string;
  trip_id: string;
  recorded_at: string;
  body: string | null;
  mood: string | null;
  place_name: string | null;
  weather: string | null;
};

export type LocalExpense = Sync & {
  id: string;
  trip_id: string;
  category: string;
  amount: number;
  currency: string;
  note: string | null;
  spent_on: string | null;
};

export type LocalPackingItem = Sync & {
  id: string;
  trip_id: string;
  label: string;
  packed: number;
  sort_order: number;
};

export type LocalEntryMedia = Sync & {
  id: string;
  trip_id: string;
  entry_id: string;
  local_uri: string;
  storage_path: string | null;
  mime_type: string | null;
  kind: 'photo' | 'audio';
  size_bytes: number | null;
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

export type SyncTable = 'trips' | 'entries' | 'expenses' | 'packing_items' | 'entry_media';
export const SYNC_TABLES: SyncTable[] = ['trips', 'entries', 'expenses', 'packing_items', 'entry_media'];

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------
export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', [key]))?.value ?? null;
}

export async function setMeta(key: string, value: string | null) {
  const db = await getDb();
  if (value == null) await db.runAsync('DELETE FROM meta WHERE key = ?', [key]);
  else
    await db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value]
    );
}

// ---------------------------------------------------------------------------
// Account ownership: local data belongs to exactly one cloud account
// ---------------------------------------------------------------------------
const OWNER_KEY = 'owner_id';

export async function getOwnerId() {
  return getMeta(OWNER_KEY);
}

/**
 * Called when a cloud session becomes available.
 * - no owner yet  -> adopt the on-device (guest) data for this account
 * - same owner    -> nothing to do
 * - other owner   -> wipe (never push one person's rows into another account)
 * Returns the media file URIs that were discarded so callers can delete them.
 */
export async function claimLocalData(userId: string): Promise<{ wiped: boolean; discardedUris: string[] }> {
  const owner = await getOwnerId();
  if (owner === userId) return { wiped: false, discardedUris: [] };
  if (owner == null) {
    await setMeta(OWNER_KEY, userId);
    return { wiped: false, discardedUris: [] };
  }
  const discardedUris = await wipeAllData();
  await setMeta(OWNER_KEY, userId);
  return { wiped: true, discardedUris };
}

/** Removes every row (used on sign-out / account deletion). Returns local media URIs to delete. */
export async function wipeAllData(): Promise<string[]> {
  const db = await getDb();
  const uris = (await db.getAllAsync<{ local_uri: string }>("SELECT local_uri FROM entry_media WHERE local_uri != ''")).map(
    r => r.local_uri
  );
  await runInTransaction(async () => {
    for (const t of [...SYNC_TABLES, 'track_points', 'meta']) await db.runAsync(`DELETE FROM ${t}`);
  });
  return uris;
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------
export async function listTrips(): Promise<LocalTrip[]> {
  const db = await getDb();
  return db.getAllAsync<LocalTrip>('SELECT * FROM trips WHERE deleted = 0 ORDER BY updated_at DESC');
}

export async function getTrip(id: string): Promise<LocalTrip | null> {
  const db = await getDb();
  return db.getFirstAsync<LocalTrip>('SELECT * FROM trips WHERE id = ? AND deleted = 0', [id]);
}

/** Raw lookup including tombstones (sync engine only). */
export async function getRow<T>(table: SyncTable, id: string): Promise<(T & { deleted: number }) | null> {
  const db = await getDb();
  return db.getFirstAsync<T & { deleted: number }>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

export async function upsertTrip(t: LocalTrip) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO trips (id, title, trip_type, destination, starts_on, ends_on, visibility, companions, status, notes, share_id, sync_status, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, trip_type=excluded.trip_type, destination=excluded.destination,
       starts_on=excluded.starts_on, ends_on=excluded.ends_on, visibility=excluded.visibility,
       companions=excluded.companions, status=excluded.status, notes=excluded.notes, share_id=excluded.share_id,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at, deleted=0`,
    [t.id, t.title, t.trip_type, t.destination, t.starts_on, t.ends_on, t.visibility, t.companions, t.status, t.notes, t.share_id ?? null, t.sync_status, t.updated_at]
  );
}

/**
 * Deletes a trip locally: children vanish immediately, the trip stays as a
 * tombstone until the cloud confirms. Returns local media URIs to remove from disk.
 */
export async function deleteTrip(id: string): Promise<string[]> {
  const db = await getDb();
  const uris = (
    await db.getAllAsync<{ local_uri: string }>("SELECT local_uri FROM entry_media WHERE trip_id = ? AND local_uri != ''", [id])
  ).map(r => r.local_uri);
  await runInTransaction(async () => {
    for (const t of ['entry_media', 'entries', 'expenses', 'packing_items', 'track_points']) {
      await db.runAsync(`DELETE FROM ${t} WHERE trip_id = ?`, [id]);
    }
    await db.runAsync(
      "UPDATE trips SET deleted = 1, visibility = 'private', share_id = NULL, sync_status = 'pending', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );
  });
  return uris;
}

/** Removes a trip and everything under it with no tombstone (remote said it is gone). */
export async function purgeTripLocal(id: string): Promise<string[]> {
  const db = await getDb();
  const uris = (
    await db.getAllAsync<{ local_uri: string }>("SELECT local_uri FROM entry_media WHERE trip_id = ? AND local_uri != ''", [id])
  ).map(r => r.local_uri);
  await runInTransaction(async () => {
    for (const t of ['entry_media', 'entries', 'expenses', 'packing_items', 'track_points', 'trips']) {
      await db.runAsync(`DELETE FROM ${t} WHERE ${t === 'trips' ? 'id' : 'trip_id'} = ?`, [id]);
    }
  });
  return uris;
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------
export async function listEntries(tripId: string): Promise<LocalEntry[]> {
  const db = await getDb();
  return db.getAllAsync<LocalEntry>('SELECT * FROM entries WHERE trip_id = ? AND deleted = 0 ORDER BY recorded_at ASC', [tripId]);
}

export async function upsertEntry(e: LocalEntry) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO entries (id, trip_id, recorded_at, body, mood, place_name, weather, sync_status, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET recorded_at=excluded.recorded_at, body=excluded.body, mood=excluded.mood,
       place_name=excluded.place_name, weather=excluded.weather, sync_status=excluded.sync_status,
       updated_at=excluded.updated_at, deleted=0`,
    [e.id, e.trip_id, e.recorded_at, e.body, e.mood, e.place_name, e.weather, e.sync_status, e.updated_at]
  );
}

/** Tombstones an entry and its media. Returns local media URIs to remove from disk. */
export async function deleteEntry(id: string): Promise<string[]> {
  const db = await getDb();
  const now = new Date().toISOString();
  const uris = (
    await db.getAllAsync<{ local_uri: string }>("SELECT local_uri FROM entry_media WHERE entry_id = ? AND local_uri != ''", [id])
  ).map(r => r.local_uri);
  await runInTransaction(async () => {
    await db.runAsync("UPDATE entry_media SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE entry_id = ?", [now, id]);
    await db.runAsync("UPDATE entries SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?", [now, id]);
  });
  return uris;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export async function listExpenses(tripId: string): Promise<LocalExpense[]> {
  const db = await getDb();
  return db.getAllAsync<LocalExpense>(
    'SELECT * FROM expenses WHERE trip_id = ? AND deleted = 0 ORDER BY spent_on DESC, updated_at DESC',
    [tripId]
  );
}

export async function upsertExpense(x: LocalExpense) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO expenses (id, trip_id, category, amount, currency, note, spent_on, sync_status, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, amount=excluded.amount, currency=excluded.currency,
       note=excluded.note, spent_on=excluded.spent_on, sync_status=excluded.sync_status,
       updated_at=excluded.updated_at, deleted=0`,
    [x.id, x.trip_id, x.category, x.amount, x.currency, x.note, x.spent_on, x.sync_status, x.updated_at]
  );
}

export async function deleteExpense(id: string) {
  const db = await getDb();
  await db.runAsync("UPDATE expenses SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------
export async function listPacking(tripId: string): Promise<LocalPackingItem[]> {
  const db = await getDb();
  return db.getAllAsync<LocalPackingItem>(
    'SELECT * FROM packing_items WHERE trip_id = ? AND deleted = 0 ORDER BY sort_order ASC, label ASC',
    [tripId]
  );
}

export async function upsertPackingItem(p: LocalPackingItem) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO packing_items (id, trip_id, label, packed, sort_order, sync_status, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET label=excluded.label, packed=excluded.packed, sort_order=excluded.sort_order,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at, deleted=0`,
    [p.id, p.trip_id, p.label, p.packed, p.sort_order, p.sync_status, p.updated_at]
  );
}

export async function deletePackingItem(id: string) {
  const db = await getDb();
  await db.runAsync("UPDATE packing_items SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
}

export async function seedPackingTemplate(tripId: string, labels: string[]) {
  const now = new Date().toISOString();
  const db = await getDb();
  await runInTransaction(async () => {
    for (let i = 0; i < labels.length; i++) {
      await db.runAsync(
        `INSERT INTO packing_items (id, trip_id, label, packed, sort_order, sync_status, updated_at, deleted)
         VALUES (?, ?, ?, 0, ?, 'pending', ?, 0)`,
        [newId(), tripId, labels[i], i, now]
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Track points
// ---------------------------------------------------------------------------
export async function countTrackPoints(tripId: string) {
  const db = await getDb();
  return (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM track_points WHERE trip_id = ?', [tripId]))?.c ?? 0;
}

export async function insertTrackPoint(p: Omit<LocalTrackPoint, 'sync_status'>) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO track_points (id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [p.id, p.trip_id, p.recorded_at, p.latitude, p.longitude, p.altitude_m, p.accuracy_m]
  );
}

export async function insertRemoteTrackPoints(rows: Omit<LocalTrackPoint, 'sync_status'>[]) {
  if (!rows.length) return 0;
  const db = await getDb();
  let inserted = 0;
  await runInTransaction(async () => {
    for (const p of rows) {
      const r = await db.runAsync(
        `INSERT OR IGNORE INTO track_points (id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [p.id, p.trip_id, p.recorded_at, p.latitude, p.longitude, p.altitude_m, p.accuracy_m]
      );
      inserted += r.changes;
    }
  });
  return inserted;
}

export async function listPendingTrackPoints(limit = 500) {
  const db = await getDb();
  return db.getAllAsync<LocalTrackPoint>(
    "SELECT * FROM track_points WHERE sync_status = 'pending' ORDER BY recorded_at ASC LIMIT ?",
    [limit]
  );
}

export async function markTrackPointsSynced(ids: string[]) {
  if (!ids.length) return;
  const db = await getDb();
  await db.runAsync(`UPDATE track_points SET sync_status = 'synced' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

export async function listTrackPointsForExport(tripId: string) {
  const db = await getDb();
  return db.getAllAsync<{ recorded_at: string; latitude: number; longitude: number; altitude_m: number | null }>(
    'SELECT recorded_at, latitude, longitude, altitude_m FROM track_points WHERE trip_id = ? ORDER BY recorded_at ASC',
    [tripId]
  );
}

// ---------------------------------------------------------------------------
// Entry media
// ---------------------------------------------------------------------------
export async function listEntryMedia(entryId: string): Promise<LocalEntryMedia[]> {
  const db = await getDb();
  return db.getAllAsync<LocalEntryMedia>(
    'SELECT * FROM entry_media WHERE entry_id = ? AND deleted = 0 ORDER BY updated_at ASC',
    [entryId]
  );
}

export async function upsertEntryMedia(m: LocalEntryMedia) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO entry_media (id, trip_id, entry_id, local_uri, storage_path, mime_type, kind, size_bytes, sync_status, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET local_uri=excluded.local_uri, storage_path=excluded.storage_path,
       mime_type=excluded.mime_type, kind=excluded.kind, size_bytes=excluded.size_bytes,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at, deleted=0`,
    [m.id, m.trip_id, m.entry_id, m.local_uri, m.storage_path, m.mime_type, m.kind, m.size_bytes, m.sync_status, m.updated_at]
  );
}

export async function deleteEntryMedia(id: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ local_uri: string }>('SELECT local_uri FROM entry_media WHERE id = ?', [id]);
  await db.runAsync("UPDATE entry_media SET deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
  return row?.local_uri || null;
}

// ---------------------------------------------------------------------------
// Sync bookkeeping
// ---------------------------------------------------------------------------
export async function listPending<T>(table: SyncTable, deleted: 0 | 1): Promise<(T & { deleted: number })[]> {
  const db = await getDb();
  return db.getAllAsync<T & { deleted: number }>(
    `SELECT * FROM ${table} WHERE sync_status = 'pending' AND deleted = ? ORDER BY updated_at ASC`,
    [deleted]
  );
}

/** Marks a row synced only if it was not edited again while the push was in flight. */
export async function markSyncedIfUnchanged(table: SyncTable, id: string, updatedAt: string) {
  const db = await getDb();
  await db.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ? AND updated_at = ?`, [id, updatedAt]);
}

/** Removes a tombstone once the cloud has recorded the delete (if not resurrected meanwhile). */
export async function purgeTombstone(table: SyncTable, id: string, updatedAt: string) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ? AND deleted = 1 AND updated_at = ?`, [id, updatedAt]);
}

export async function purgeRow(table: SyncTable, id: string) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function countPendingSync() {
  const db = await getDb();
  const parts = [...SYNC_TABLES, 'track_points'].map(t => `(SELECT COUNT(*) FROM ${t} WHERE sync_status = 'pending')`);
  return (await db.getFirstAsync<{ c: number }>(`SELECT ${parts.join(' + ')} AS c`))?.c ?? 0;
}

export async function listMediaPaths(tripId: string): Promise<string[]> {
  const db = await getDb();
  return (
    await db.getAllAsync<{ storage_path: string }>(
      "SELECT storage_path FROM entry_media WHERE trip_id = ? AND storage_path IS NOT NULL AND storage_path != ''",
      [tripId]
    )
  ).map(r => r.storage_path);
}
