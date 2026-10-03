import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  claimLocalData,
  countPendingSync,
  deleteEntry,
  deleteTrip,
  getDb,
  getMeta,
  getOwnerId,
  listEntries,
  listPacking,
  listTrips,
  markSyncedIfUnchanged,
  purgeTripLocal,
  runInTransaction,
  seedPackingTemplate,
  setDbOpener,
  upsertEntry,
  upsertEntryMedia,
  upsertTrip,
  wipeAllData,
  type LocalTrip,
} from '../src/lib/localDb';
import { createNodeDb } from './helpers/sqlite';

const NOW = '2026-10-01T10:00:00.000Z';
const trip = (id: string, over: Partial<LocalTrip> = {}): LocalTrip => ({
  id, title: `Trip ${id}`, trip_type: 'trek', destination: null, starts_on: null, ends_on: null,
  visibility: 'private', companions: null, status: 'active', notes: null, share_id: null,
  sync_status: 'pending', updated_at: NOW, ...over,
});
const entry = (id: string, tripId: string) => ({
  id, trip_id: tripId, recorded_at: NOW, body: 'hello', mood: null, place_name: null, weather: null,
  sync_status: 'pending', updated_at: NOW,
});

beforeEach(() => {
  setDbOpener(async () => createNodeDb());
});

describe('migrations', () => {
  it('creates the current schema on a fresh install', async () => {
    const db = await getDb();
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, 2);
    for (const t of ['trips', 'entries', 'expenses', 'packing_items', 'entry_media']) {
      const cols = (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map(c => c.name);
      assert.ok(cols.includes('deleted'), `${t}.deleted`);
    }
  });

  it('upgrades a v1.x database in place and repairs non-UUID packing ids', async () => {
    const raw = createNodeDb();
    raw.raw.exec(`
      CREATE TABLE trips (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, trip_type TEXT NOT NULL DEFAULT 'trek', destination TEXT, starts_on TEXT, ends_on TEXT, visibility TEXT NOT NULL DEFAULT 'private', companions TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL, share_id TEXT);
      CREATE TABLE entries (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, recorded_at TEXT NOT NULL, body TEXT, mood TEXT, place_name TEXT, weather TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL);
      CREATE TABLE expenses (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', note TEXT, spent_on TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL);
      CREATE TABLE packing_items (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, label TEXT NOT NULL, packed INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, sync_status TEXT NOT NULL DEFAULT 'synced', updated_at TEXT NOT NULL);
      CREATE TABLE track_points (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, recorded_at TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, altitude_m REAL, accuracy_m REAL, sync_status TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE entry_media (id TEXT PRIMARY KEY NOT NULL, trip_id TEXT NOT NULL, entry_id TEXT NOT NULL, local_uri TEXT NOT NULL, storage_path TEXT, mime_type TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', updated_at TEXT NOT NULL);
      INSERT INTO trips (id,title,updated_at) VALUES ('t1','Old trip','${NOW}');
      INSERT INTO packing_items (id,trip_id,label,updated_at) VALUES ('t1-pack-0','t1','Thermals','${NOW}');
      INSERT INTO entry_media (id,trip_id,entry_id,local_uri,mime_type,updated_at) VALUES ('m1','t1','e1','file:///v.m4a','audio/m4a','${NOW}');
    `);
    setDbOpener(async () => raw);
    const items = await listPacking('t1');
    assert.equal(items.length, 1);
    assert.match(items[0].id, /^[0-9a-f-]{36}$/);
    assert.equal(items[0].sync_status, 'pending', 'repaired rows must be re-pushed');
    assert.equal((await listTrips()).length, 1);
    const media = await raw.getFirstAsync<{ kind: string }>('SELECT kind FROM entry_media WHERE id = ?', ['m1']);
    assert.equal(media?.kind, 'audio');
  });

  it('is idempotent when reopened', async () => {
    const raw = createNodeDb();
    setDbOpener(async () => raw);
    await upsertTrip(trip('t1'));
    setDbOpener(async () => raw);
    assert.equal((await listTrips()).length, 1);
  });
});

describe('account ownership', () => {
  it('adopts guest data on first sign-in', async () => {
    await upsertTrip(trip('t1'));
    const r = await claimLocalData('user-a');
    assert.equal(r.wiped, false);
    assert.equal((await listTrips()).length, 1);
    assert.equal(await getOwnerId(), 'user-a');
  });

  it('keeps data when the same user returns', async () => {
    await claimLocalData('user-a');
    await upsertTrip(trip('t1'));
    assert.equal((await claimLocalData('user-a')).wiped, false);
    assert.equal((await listTrips()).length, 1);
  });

  it("never lets another account inherit (or upload) the previous user's data", async () => {
    await claimLocalData('user-a');
    await upsertTrip(trip('t1'));
    await upsertEntryMedia({ id: 'm1', trip_id: 't1', entry_id: 'e1', local_uri: 'file:///a.jpg', storage_path: null, mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'pending', updated_at: NOW });
    const r = await claimLocalData('user-b');
    assert.equal(r.wiped, true);
    assert.deepEqual(r.discardedUris, ['file:///a.jpg']);
    assert.equal((await listTrips()).length, 0);
    assert.equal(await countPendingSync(), 0);
    assert.equal(await getOwnerId(), 'user-b');
  });

  it('wipeAllData clears everything including meta', async () => {
    await claimLocalData('user-a');
    await upsertTrip(trip('t1'));
    await wipeAllData();
    assert.equal((await listTrips()).length, 0);
    assert.equal(await getMeta('owner_id'), null);
  });
});

describe('tombstones', () => {
  it('deleteTrip hides the trip, removes children, and leaves one pending tombstone', async () => {
    await upsertTrip(trip('t1', { sync_status: 'synced', visibility: 'link', share_id: 's'.repeat(24) }));
    await upsertEntry(entry('e1', 't1'));
    await seedPackingTemplate('t1', ['A', 'B']);
    await upsertEntryMedia({ id: 'm1', trip_id: 't1', entry_id: 'e1', local_uri: 'file:///a.jpg', storage_path: null, mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'pending', updated_at: NOW });

    const uris = await deleteTrip('t1');
    assert.deepEqual(uris, ['file:///a.jpg']);
    assert.equal((await listTrips()).length, 0);
    assert.equal((await listEntries('t1')).length, 0);
    assert.equal((await listPacking('t1')).length, 0);
    const db = await getDb();
    const row = await db.getFirstAsync<{ deleted: number; share_id: string | null; visibility: string; sync_status: string }>('SELECT * FROM trips WHERE id = ?', ['t1']);
    assert.deepEqual([row?.deleted, row?.share_id, row?.visibility, row?.sync_status], [1, null, 'private', 'pending']);
    assert.equal(await countPendingSync(), 1);
  });

  it('deleteEntry tombstones the entry and its media', async () => {
    await upsertTrip(trip('t1'));
    await upsertEntry({ ...entry('e1', 't1'), sync_status: 'synced' });
    await upsertEntryMedia({ id: 'm1', trip_id: 't1', entry_id: 'e1', local_uri: '', storage_path: 'u/t1/m1.jpg', mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'synced', updated_at: NOW });
    await deleteEntry('e1');
    assert.equal((await listEntries('t1')).length, 0);
    const db = await getDb();
    const m = await db.getFirstAsync<{ deleted: number; sync_status: string }>('SELECT deleted, sync_status FROM entry_media WHERE id = ?', ['m1']);
    assert.deepEqual([m?.deleted, m?.sync_status], [1, 'pending']);
  });

  it('markSyncedIfUnchanged does not clobber an edit made while the push was in flight', async () => {
    await upsertTrip(trip('t1', { updated_at: '2026-10-01T10:00:00.000Z' }));
    // user edits again after the sync read the row
    await upsertTrip(trip('t1', { title: 'Edited', updated_at: '2026-10-01T10:00:05.000Z' }));
    await markSyncedIfUnchanged('trips', 't1', '2026-10-01T10:00:00.000Z');
    const db = await getDb();
    assert.equal((await db.getFirstAsync<{ sync_status: string }>('SELECT sync_status FROM trips WHERE id = ?', ['t1']))?.sync_status, 'pending');
  });

  it('nested transactions join the outer one instead of failing', async () => {
    await upsertTrip(trip('t1'));
    await runInTransaction(async () => {
      await purgeTripLocal('t1'); // opens its own runInTransaction internally
    });
    const db = await getDb();
    assert.equal((await db.getFirstAsync('SELECT id FROM trips WHERE id = ?', ['t1'])), null);
  });
});
