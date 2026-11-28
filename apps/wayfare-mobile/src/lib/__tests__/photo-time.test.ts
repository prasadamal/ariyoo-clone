import assert from 'node:assert/strict';
import test from 'node:test';
import { earliestTakenAt, exifTakenAt } from '../photoTime';

const now = new Date('2026-11-28T12:00:00Z');

test('photo time from EXIF: local time, with the offset when the camera saved it', () => {
  const local = exifTakenAt({ DateTimeOriginal: '2026:03:12 09:14:33' }, now);
  assert.equal(local, new Date(2026, 2, 12, 9, 14, 33).toISOString());
  assert.equal(exifTakenAt({ DateTimeOriginal: '2026:03:12 09:14:33', OffsetTimeOriginal: '+05:30' }, now), '2026-03-12T03:44:33.000Z');
  assert.equal(exifTakenAt({ DateTime: '2026-03-12 09:14' }, now), new Date(2026, 2, 12, 9, 14, 0).toISOString(), 'falls back to DateTime');
});

test('photo time: missing, broken, impossible or future dates are ignored', () => {
  assert.equal(exifTakenAt(null, now), null);
  assert.equal(exifTakenAt({}, now), null);
  assert.equal(exifTakenAt({ DateTimeOriginal: '0000:00:00 00:00:00' }, now), null);
  assert.equal(exifTakenAt({ DateTimeOriginal: '2026:02:31 10:00:00' }, now), null, '31 February');
  assert.equal(exifTakenAt({ DateTimeOriginal: '1980:01:01 10:00:00' }, now), null, 'before 1990');
  assert.equal(exifTakenAt({ DateTimeOriginal: '2027:01:01 10:00:00' }, now), null, 'in the future');
  assert.equal(exifTakenAt({ DateTimeOriginal: 42 }, now), null);
});

test('a moment takes its earliest photo time', () => {
  assert.equal(earliestTakenAt(['2026-03-12T10:00:00.000Z', null, '2026-03-12T08:00:00.000Z']), '2026-03-12T08:00:00.000Z');
  assert.equal(earliestTakenAt([null, undefined]), null);
});
