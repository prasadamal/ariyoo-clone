import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeMediaFolders, type WipeFs } from '../mediaWipe';

function fakeFs(files: string[], opts: { stuck?: string; throws?: string } = {}) {
  const present = new Set(files);
  const fs: WipeFs = {
    async deleteAsync(uri) {
      if (opts.throws && uri.includes(opts.throws)) throw new Error('EACCES');
      if (opts.stuck && uri.includes(opts.stuck)) return;
      for (const f of [...present]) if (f.startsWith(uri)) present.delete(f);
    },
    async getInfoAsync(uri) {
      return { exists: [...present].some(f => f.startsWith(uri)) };
    },
  };
  return { fs, present };
}

const doc = 'file:///data/app/files/';
const cache = 'file:///data/app/cache/';
const all = [
  `${doc}journal/m1.jpg`, `${doc}covers/c1.jpg`, `${doc}voice/v1.m4a`,
  `${cache}ImagePicker/p.jpg`, `${cache}Audio/r.m4a`, `${doc}SQLite/wayfare.db`,
];

test('removes photos, covers, voice notes and picker copies, nothing else', async () => {
  const { fs, present } = fakeFs(all);
  assert.deepEqual(await removeMediaFolders(fs, doc, cache), []);
  assert.deepEqual([...present], [`${doc}SQLite/wayfare.db`]);
});

test('reports folders that could not be deleted, so the user can retry', async () => {
  const stuck = fakeFs(all, { stuck: '/voice/' });
  assert.deepEqual(await removeMediaFolders(stuck.fs, doc, cache), ['voice']);
  const throws = fakeFs(all, { throws: '/journal/' });
  assert.deepEqual(await removeMediaFolders(throws.fs, doc, cache), ['journal']);
});

test('cache failures are best effort and never block', async () => {
  const { fs } = fakeFs(all, { throws: 'ImagePicker' });
  assert.deepEqual(await removeMediaFolders(fs, doc, cache), []);
});

test('second run after a partial failure succeeds (idempotent)', async () => {
  const { fs } = fakeFs(all);
  await removeMediaFolders(fs, doc, cache);
  assert.deepEqual(await removeMediaFolders(fs, doc, cache), []);
});
