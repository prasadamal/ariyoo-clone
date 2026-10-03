import * as SQLite from 'expo-sqlite';

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
  sync_status: string;
  updated_at: string;
};

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('wayfare.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
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
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

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
    `INSERT INTO trips (id, title, trip_type, destination, starts_on, ends_on, visibility, companions, status, notes, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, trip_type=excluded.trip_type, destination=excluded.destination,
       starts_on=excluded.starts_on, ends_on=excluded.ends_on, visibility=excluded.visibility,
       companions=excluded.companions, status=excluded.status, notes=excluded.notes,
       sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
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
      trip.sync_status,
      trip.updated_at,
    ]
  );
}

export async function deleteTrip(id: string) {
  const database = await getDb();
  await database.runAsync('DELETE FROM entries WHERE trip_id = ?', [id]);
  await database.runAsync('DELETE FROM expenses WHERE trip_id = ?', [id]);
  await database.runAsync('DELETE FROM packing_items WHERE trip_id = ?', [id]);
  await database.runAsync('DELETE FROM track_points WHERE trip_id = ?', [id]);
  await database.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

export type LocalEntry = {
  id: string;
  trip_id: string;
  recorded_at: string;
  body: string | null;
  mood: string | null;
  place_name: string | null;
  weather: string | null;
  sync_status: string;
  updated_at: string;
};

export async function listEntries(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalEntry>(
    'SELECT * FROM entries WHERE trip_id = ? ORDER BY recorded_at ASC',
    [tripId]
  );
}

export async function upsertEntry(entry: LocalEntry) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO entries (id, trip_id, recorded_at, body, mood, place_name, weather, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET body=excluded.body, mood=excluded.mood, place_name=excluded.place_name,
       weather=excluded.weather, sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      entry.id,
      entry.trip_id,
      entry.recorded_at,
      entry.body,
      entry.mood,
      entry.place_name,
      entry.weather,
      entry.sync_status,
      entry.updated_at,
    ]
  );
}

export type LocalExpense = {
  id: string;
  trip_id: string;
  category: string;
  amount: number;
  currency: string;
  note: string | null;
  spent_on: string | null;
  sync_status: string;
  updated_at: string;
};

export async function listExpenses(tripId: string) {
  const database = await getDb();
  return database.getAllAsync<LocalExpense>('SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_on DESC', [
    tripId,
  ]);
}

export async function upsertExpense(expense: LocalExpense) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO expenses (id, trip_id, category, amount, currency, note, spent_on, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET category=excluded.category, amount=excluded.amount, currency=excluded.currency,
       note=excluded.note, spent_on=excluded.spent_on, sync_status=excluded.sync_status, updated_at=excluded.updated_at`,
    [
      expense.id,
      expense.trip_id,
      expense.category,
      expense.amount,
      expense.currency,
      expense.note,
      expense.spent_on,
      expense.sync_status,
      expense.updated_at,
    ]
  );
}

export type LocalPackingItem = {
  id: string;
  trip_id: string;
  label: string;
  packed: number;
  sort_order: number;
  sync_status: string;
  updated_at: string;
};

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

export async function seedPackingTemplate(tripId: string, labels: string[]) {
  const now = new Date().toISOString();
  for (let i = 0; i < labels.length; i++) {
    const id = `${tripId}-pack-${i}`;
    await upsertPackingItem({
      id,
      trip_id: tripId,
      label: labels[i],
      packed: 0,
      sort_order: i,
      sync_status: 'pending',
      updated_at: now,
    });
  }
}

export async function countTrackPoints(tripId: string) {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM track_points WHERE trip_id = ?',
    [tripId]
  );
  return row?.c ?? 0;
}

export async function insertTrackPoint(point: {
  id: string;
  trip_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  accuracy_m: number | null;
}) {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO track_points (id, trip_id, recorded_at, latitude, longitude, altitude_m, accuracy_m, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      point.id,
      point.trip_id,
      point.recorded_at,
      point.latitude,
      point.longitude,
      point.altitude_m,
      point.accuracy_m,
    ]
  );
}
