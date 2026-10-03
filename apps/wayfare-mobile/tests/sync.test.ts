import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  claimLocalData,
  countPendingSync,
  deleteEntry,
  deleteTrip,
  getDb,
  getMeta,
  insertTrackPoint,
  listEntries,
  listExpenses,
  listTrips,
  seedPackingTemplate,
  setDbOpener,
  upsertEntry,
  upsertEntryMedia,
  upsertExpense,
  upsertTrip,
  type LocalTrip,
} from '../src/lib/localDb';
import { haltSync, resumeSync, syncAll, type SyncDeps } from '../src/lib/sync';
import { FakeServer } from './helpers/fakeSupabase';
import { createNodeDb } from './helpers/sqlite';

const USER = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-10-01T10:00:00.000Z';
const SHARE = 'abcdefghijklmnopqrstuvwxyz012345';
const T1 = 'aaaaaaaa-0000-4000-8000-000000000001';

const trip = (id = T1, over: Partial<LocalTrip> = {}): LocalTrip => ({
  id, title: 'Kedarkantha', trip_type: 'trek', destination: 'Uttarakhand', starts_on: null, ends_on: null,
  visibility: 'private', companions: null, status: 'active', notes: null, share_id: null,
  sync_status: 'pending', updated_at: NOW, ...over,
});
const entry = (id: string, over: Record<string, unknown> = {}) => ({
  id, trip_id: T1, recorded_at: NOW, body: `body ${id}`, mood: null, place_name: null, weather: null,
  sync_status: 'pending', updated_at: NOW, ...over,
});

let server: FakeServer;
let removedLocalFiles: string[];
let existingFiles: Set<string>;
let online = true;

function deps(over: Partial<SyncDeps> = {}): SyncDeps {
  return {
    client: server.client(),
    isOnline: async () => online,
    uploadMedia: async p => ({ path: `${p.userId}/${p.tripId}/${p.mediaId}.bin`, size: 10 }),
    removeRemoteObjects: async paths => { server.storageRemoved.push(...paths); },
    deleteLocalFiles: uris => { removedLocalFiles.push(...uris); },
    fileExists: uri => existingFiles.has(uri),
    ...over,
  };
}

beforeEach(async () => {
  server = new FakeServer();
  removedLocalFiles = [];
  existingFiles = new Set();
  online = true;
  setDbOpener(async () => createNodeDb());
  await claimLocalData(USER);
});

describe('push', () => {
  it('uploads pending rows once, marks them synced, and is idempotent', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    await upsertExpense({ id: 'x1', trip_id: T1, category: 'food', amount: 450, currency: 'INR', note: null, spent_on: '2026-10-01', sync_status: 'pending', updated_at: NOW });
    await seedPackingTemplate(T1, ['Thermals', 'Gaiters']);
    await insertTrackPoint({ id: 'p1', trip_id: T1, recorded_at: NOW, latitude: 30.1, longitude: 78.2, altitude_m: 2000, accuracy_m: 10 });

    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    assert.deepEqual([r.pushed.trips, r.pushed.entries, r.pushed.expenses, r.pushed.packing, r.pushed.track_points], [1, 1, 1, 2, 1]);
    assert.equal(await countPendingSync(), 0);
    assert.equal(server.rows('trips')[0].user_id, USER, 'rows are always stamped with the signed-in user');
    assert.ok(server.rows('trips')[0].updated_at, 'server stamps updated_at');

    const before = server.calls.filter(c => c.op === 'upsert').length;
    const again = await syncAll(USER, deps());
    assert.equal(again.pushed.entries + again.pushed.trips, 0);
    assert.equal(server.calls.filter(c => c.op === 'upsert').length, before, 'nothing is re-uploaded');
  });

  it('sends one batched request per table, not one per row', async () => {
    await upsertTrip(trip());
    for (let i = 0; i < 250; i++) await upsertEntry(entry(`e${i}`));
    await syncAll(USER, deps());
    const entryUpserts = server.calls.filter(c => c.op === 'upsert' && c.table === 'entries');
    assert.deepEqual(entryUpserts.map(c => c.n), [100, 100, 50]);
    assert.equal(server.rows('entries').length, 250);
  });

  it('isolates a rejected row so the rest still sync', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('ok1'));
    await upsertEntry(entry('bad', { body: 'POISON' }));
    await upsertEntry(entry('ok2'));
    server.failWrite = (table, rows) => (table === 'entries' && rows.some(r => r.body === 'POISON') ? 'check constraint violated' : null);

    const r = await syncAll(USER, deps());
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /check constraint/);
    assert.deepEqual(server.rows('entries').map(e => e.id).sort(), ['ok1', 'ok2']);
    assert.equal(await countPendingSync(), 1, 'only the bad row stays pending');
  });

  it('only exposes a share link when visibility is link AND a share id exists', async () => {
    await upsertTrip(trip(T1, { visibility: 'link', share_id: SHARE }));
    await upsertTrip(trip('aaaaaaaa-0000-4000-8000-000000000002', { visibility: 'link', share_id: null }));
    await syncAll(USER, deps());
    const rows = server.rows('trips');
    const shared = rows.find(r => r.id === T1)!;
    const broken = rows.find(r => r.id !== T1)!;
    assert.deepEqual([shared.visibility, shared.share_id], ['link', SHARE]);
    assert.deepEqual([broken.visibility, broken.share_id], ['private', null], 'would otherwise violate the DB check constraint');
  });
});

describe('pull', () => {
  it('downloads rows created on another device', async () => {
    server.remoteWrite('trips', { id: T1, user_id: USER, title: 'From phone B', trip_type: 'trek', visibility: 'private', status: 'active', deleted_at: null });
    server.remoteWrite('entries', { id: 'e9', trip_id: T1, user_id: USER, recorded_at: NOW, body: 'hi from B', deleted_at: null });
    server.remoteWrite('expenses', { id: 'x9', trip_id: T1, user_id: USER, category: 'stay', amount: '1200.50', currency: 'INR', deleted_at: null });
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    assert.equal((await listTrips())[0].title, 'From phone B');
    assert.equal((await listEntries(T1))[0].body, 'hi from B');
    assert.equal((await listExpenses(T1))[0].amount, 1200.5, 'numeric strings are converted');
    assert.equal(await countPendingSync(), 0, 'pulled rows are not queued for upload');
  });

  it("never reads another user's rows", async () => {
    server.remoteWrite('trips', { id: T1, user_id: 'someone-else', title: 'Not yours', trip_type: 'trek', visibility: 'private', status: 'active' });
    await syncAll(USER, deps());
    assert.equal((await listTrips()).length, 0);
  });

  it('pages through large tables', async () => {
    server.remoteWrite('trips', { id: T1, user_id: USER, title: 'Big', trip_type: 'trek', visibility: 'private', status: 'active' });
    for (let i = 0; i < 1200; i++) server.remoteWrite('entries', { id: `e${i}`, trip_id: T1, user_id: USER, recorded_at: NOW, body: `n${i}` });
    const r = await syncAll(USER, deps());
    assert.equal(r.pulled.entries, 1200);
    assert.equal((await listEntries(T1)).length, 1200);
  });

  it('is incremental: rows older than the cursor window are not transferred again', async () => {
    const id = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
    for (const n of [1, 2, 3]) {
      server.clock += 10 * 60 * 1000; // ten minutes apart (> the 2-minute overlap window)
      server.remoteWrite('trips', { id: id(n), user_id: USER, title: `Old ${n}`, trip_type: 'trek', visibility: 'private', status: 'active' });
    }
    const first = await syncAll(USER, deps());
    assert.equal(first.pulled.trips, 3, 'first sync downloads everything');
    assert.ok(await getMeta('cursor:trips'), 'cursor stored');

    server.clock += 60 * 60 * 1000;
    server.remoteWrite('trips', { id: id(4), user_id: USER, title: 'New', trip_type: 'road', visibility: 'private', status: 'active' });
    const second = await syncAll(USER, deps());
    // The newest previously-seen row is re-read on purpose (overlap guards against out-of-order commits);
    // the two older ones are not.
    assert.equal(second.pulled.trips, 2);
    assert.equal((await listTrips()).length, 4);
  });

  it('keeps a locally pending edit instead of overwriting it with the server copy', async () => {
    server.remoteWrite('trips', { id: T1, user_id: USER, title: 'Server title', trip_type: 'trek', visibility: 'private', status: 'active' });
    await syncAll(USER, deps());
    await upsertTrip({ ...(await listTrips())[0], title: 'My offline edit', sync_status: 'pending', updated_at: '2026-10-02T00:00:00.000Z' });
    server.clock += 60 * 60 * 1000;
    server.remoteWrite('trips', { id: T1, title: 'Server changed again' });
    await syncAll(USER, deps());
    // local edit was pushed over the server copy, and the user never saw it flicker back
    assert.equal(server.rows('trips')[0].title, 'My offline edit');
    assert.equal((await listTrips())[0].title, 'My offline edit');
  });

  it('applies remote deletions (and cleans up the local files)', async () => {
    await upsertTrip(trip(T1, { sync_status: 'synced' }));
    await upsertEntry(entry('e1', { sync_status: 'synced' }));
    await upsertEntryMedia({ id: 'm1', trip_id: T1, entry_id: 'e1', local_uri: 'file:///photo.jpg', storage_path: 'p', mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'synced', updated_at: NOW });
    server.remoteWrite('trips', { id: T1, user_id: USER, title: 'x', trip_type: 'trek', visibility: 'private', status: 'active', deleted_at: '2026-10-01T12:00:00Z' });
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    assert.equal((await listTrips()).length, 0);
    assert.equal((await listEntries(T1)).length, 0);
    assert.deepEqual(removedLocalFiles, ['file:///photo.jpg']);
  });
});

describe('deletes', () => {
  it('propagates an entry delete as a tombstone, then forgets it locally', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    await syncAll(USER, deps());
    await deleteEntry('e1');
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    assert.ok(server.rows('entries').find(e => e.id === 'e1')?.deleted_at, 'server row is tombstoned');
    assert.equal(await countPendingSync(), 0);
    const db = await getDb();
    assert.equal(await db.getFirstAsync('SELECT id FROM entries WHERE id = ?', ['e1']), null);
  });

  it('a record created and deleted before ever syncing never reaches the server', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('ghost'));
    await deleteEntry('ghost');
    await syncAll(USER, deps());
    assert.equal(server.rows('entries').find(e => e.id === 'ghost'), undefined);
    assert.equal(await countPendingSync(), 0);
  });

  it('deleting a trip removes server children and storage files, then tombstones the trip', async () => {
    await upsertTrip(trip(T1, { visibility: 'link', share_id: SHARE }));
    await upsertEntry(entry('e1'));
    await insertTrackPoint({ id: 'p1', trip_id: T1, recorded_at: NOW, latitude: 1, longitude: 2, altitude_m: null, accuracy_m: null });
    existingFiles.add('file:///a.jpg');
    await upsertEntryMedia({ id: 'm1', trip_id: T1, entry_id: 'e1', local_uri: 'file:///a.jpg', storage_path: null, mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'pending', updated_at: NOW });
    await syncAll(USER, deps());
    assert.equal(server.rows('entry_media').length, 1);

    await deleteTrip(T1);
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    for (const t of ['entries', 'track_points', 'entry_media', 'expenses', 'packing_items']) assert.equal(server.rows(t).length, 0, `${t} wiped`);
    assert.equal(server.storageRemoved.length, 1, 'the uploaded photo is deleted from storage');
    const t = server.rows('trips')[0];
    assert.ok(t.deleted_at);
    assert.deepEqual([t.visibility, t.share_id], ['private', null], 'share link is revoked');
    assert.equal((await listTrips()).length, 0);
    assert.equal(await countPendingSync(), 0);
  });

  it('keeps the tombstone queued (and reports it) if the server is unreachable mid-delete', async () => {
    await upsertTrip(trip());
    await syncAll(USER, deps());
    await deleteTrip(T1);
    const flaky = server.client();
    const realFrom = flaky.from.bind(flaky);
    (flaky as any).from = (t: string) => {
      if (t === 'track_points') throw new Error('network down');
      return realFrom(t);
    };
    const r = await syncAll(USER, deps({ client: flaky }));
    assert.ok(r.errors.some(e => e.includes('delete trip')));
    assert.equal(await countPendingSync(), 1, 'retried on the next sync');
    const ok = await syncAll(USER, deps());
    assert.deepEqual(ok.errors, []);
    assert.equal(await countPendingSync(), 0);
  });
});

describe('media', () => {
  it('uploads the file first, then records its metadata', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    existingFiles.add('file:///v.m4a');
    await upsertEntryMedia({ id: 'm1', trip_id: T1, entry_id: 'e1', local_uri: 'file:///v.m4a', storage_path: null, mime_type: 'audio/m4a', kind: 'audio', size_bytes: null, sync_status: 'pending', updated_at: NOW });
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    const row = server.rows('entry_media')[0];
    assert.equal(row.storage_path, `${USER}/${T1}/m1.bin`);
    assert.equal(row.user_id, USER);
    assert.equal(row.mime_type, 'audio/m4a');
    assert.equal(await countPendingSync(), 0);
  });

  it('leaves media pending when the upload fails, and retries later', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    existingFiles.add('file:///a.jpg');
    await upsertEntryMedia({ id: 'm1', trip_id: T1, entry_id: 'e1', local_uri: 'file:///a.jpg', storage_path: null, mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'pending', updated_at: NOW });
    const r = await syncAll(USER, deps({ uploadMedia: async () => { throw new Error('storage quota'); } }));
    assert.match(r.errors.join(), /storage quota/);
    assert.equal(server.rows('entry_media').length, 0);
    assert.equal(await countPendingSync(), 1);
    assert.deepEqual((await syncAll(USER, deps())).errors, []);
    assert.equal(server.rows('entry_media').length, 1);
  });

  it('drops media whose local file has vanished instead of failing forever', async () => {
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    await upsertEntryMedia({ id: 'm1', trip_id: T1, entry_id: 'e1', local_uri: 'file:///purged-by-os.jpg', storage_path: null, mime_type: 'image/jpeg', kind: 'photo', size_bytes: 1, sync_status: 'pending', updated_at: NOW });
    const r = await syncAll(USER, deps());
    assert.deepEqual(r.errors, []);
    assert.equal(await countPendingSync(), 0);
  });
});

describe('environment', () => {
  it('does nothing while offline and keeps data pending', async () => {
    await upsertTrip(trip());
    online = false;
    const r = await syncAll(USER, deps());
    assert.equal(r.skipped, 'offline');
    assert.equal(server.calls.length, 0);
    assert.equal(await countPendingSync(), 1);
  });

  it('reports unconfigured builds without crashing', async () => {
    await upsertTrip(trip());
    const r = await syncAll(USER, deps({ client: null }));
    assert.equal(r.skipped, 'unconfigured');
  });

  it('runs one sync at a time (concurrent callers share the same run)', async () => {
    await upsertTrip(trip());
    const [a, b] = await Promise.all([syncAll(USER, deps()), syncAll(USER, deps())]);
    assert.equal(a, b);
    assert.equal(server.calls.filter(c => c.op === 'upsert' && c.table === 'trips').length, 1);
  });

  it('records the last successful sync time only when there were no errors', async () => {
    await upsertTrip(trip());
    await syncAll(USER, deps());
    assert.ok(await getMeta('last_sync_at'));
  });
});

describe('safety nets', () => {
  it('refuses to upload local data that belongs to a different account', async () => {
    await upsertTrip(trip());
    const r = await syncAll('22222222-2222-4222-8222-222222222222', deps());
    assert.match(r.errors[0], /different account/);
    assert.equal(server.calls.length, 0, 'nothing is sent');
  });

  it('haltSync stops further work so a wipe cannot be undone by a late sync', async () => {
    await upsertTrip(trip());
    server.remoteWrite('trips', { id: 'aaaaaaaa-0000-4000-8000-000000000009', user_id: USER, title: 'Cloud copy', trip_type: 'trek', visibility: 'private', status: 'active' });
    await haltSync();
    const r = await syncAll(USER, deps());
    assert.equal(r.skipped, 'halted');
    assert.equal(server.calls.length, 0);
    resumeSync();
    assert.equal((await syncAll(USER, deps())).skipped, undefined);
  });

  it('haltSync waits for a run that is already in flight', async () => {
    await upsertTrip(trip());
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const slow = deps({ isOnline: async () => { await gate; return true; } });
    const running = syncAll(USER, slow);
    let halted = false;
    const h = haltSync().then(() => { halted = true; });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(halted, false, 'still waiting for the active sync');
    release();
    await h;
    await running;
    assert.equal(halted, true);
    resumeSync();
  });
});

describe('two devices', () => {
  it('device B receives what device A wrote, including later edits and deletes', async () => {
    const dbA = createNodeDb();
    const dbB = createNodeDb();

    setDbOpener(async () => dbA);
    await claimLocalData(USER);
    await upsertTrip(trip());
    await upsertEntry(entry('e1'));
    await upsertEntry(entry('e2'));
    await syncAll(USER, deps());

    setDbOpener(async () => dbB);
    await claimLocalData(USER);
    await syncAll(USER, deps());
    assert.deepEqual((await listEntries(T1)).map(e => e.id), ['e1', 'e2']);

    // A edits e1 and deletes e2
    server.clock += 60 * 60 * 1000;
    setDbOpener(async () => dbA);
    await upsertEntry(entry('e1', { body: 'edited on A', updated_at: new Date().toISOString() }));
    await deleteEntry('e2');
    await syncAll(USER, deps());

    setDbOpener(async () => dbB);
    await syncAll(USER, deps());
    const onB = await listEntries(T1);
    assert.deepEqual(onB.map(e => [e.id, e.body]), [['e1', 'edited on A']]);
    assert.equal(await countPendingSync(), 0);
  });
});

