import assert from 'node:assert/strict';
import test from 'node:test';
import { daysLabel, galleryWindow, newPhotos, photosByDay } from '../tripGallery';

const at = (y: number, mo: number, d: number, h = 10) => new Date(y, mo - 1, d, h).getTime();
const photo = (id: string, t: number) => ({ id, uri: `file:///${id}.jpg`, creationTime: t });

test('the window covers every day of the journey on the phone clock', () => {
  const w = galleryWindow('2026-06-14', '2026-06-20')!;
  assert.equal(w.after, new Date(2026, 5, 14).getTime());
  assert.equal(w.before, new Date(2026, 5, 21).getTime(), 'through the end of the last day');
  assert.equal(galleryWindow('2026-06-14', null)!.before, new Date(2026, 5, 15).getTime(), 'one-day journey');
  assert.equal(galleryWindow('bad', null), null);
});

test('photos already added, or older than the last "Not now", are not offered again', () => {
  const photos = [photo('a', at(2026, 6, 14)), photo('b', at(2026, 6, 15)), photo('c', at(2026, 6, 16))];
  assert.deepEqual(newPhotos(photos, new Set(['a'])).map(p => p.id), ['b', 'c']);
  assert.deepEqual(newPhotos(photos, new Set(), at(2026, 6, 15)).map(p => p.id), ['c']);
});

test('photos are grouped into Day 1, Day 2… oldest first', () => {
  const groups = photosByDay([photo('x', at(2026, 6, 15, 18)), photo('y', at(2026, 6, 14, 9)), photo('z', at(2026, 6, 15, 7))], '2026-06-14', '2026-06-20');
  assert.deepEqual(groups.map(g => g.label), ['Day 1', 'Day 2']);
  assert.deepEqual(groups[1].photos.map(p => p.id), ['z', 'x']);
});

test('add button names the days', () => {
  assert.equal(daysLabel(['Day 1', 'Day 3', 'Day 2']), 'Day 1–3');
  assert.equal(daysLabel(['Day 2']), 'Day 2');
  assert.equal(daysLabel(['Pre-trip', 'Day 1']), '2 days');
});
